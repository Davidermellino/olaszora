// Audio delle battute: ▶ per una frase e lettore per tutto il dialogo.
// Un solo elemento <audio> per tutta l'app: far partire una frase ferma quella che suonava prima.
import { useEffect, useRef, useState } from "react";

let shared: HTMLAudioElement | null = null;
/** Chi sta usando l'audio adesso (per fermare il lettore del dialogo quando parte un ▶). */
let owner: symbol | null = null;
const listeners = new Set<() => void>();

function audioEl(): HTMLAudioElement {
  if (!shared) {
    shared = new Audio();
    shared.preload = "auto";
  }
  return shared;
}

function claim(who: symbol) {
  if (owner !== who) {
    owner = who;
    listeners.forEach((f) => f());
  }
}

/** La frase che sta suonando: interromperla rifiuta la sua promessa con "stop". */
let pending: { cancel: () => void } | null = null;

function interrupt() {
  const p = pending;
  pending = null;
  p?.cancel();
}

/** Suona un mp3 dall'inizio. Si risolve quando finisce, si rifiuta se viene interrotto ("stop") o non si carica ("load"). */
export function playClip(src: string, who: symbol, rate = 1): Promise<void> {
  const a = audioEl();
  interrupt();
  claim(who);
  a.pause();
  return new Promise<void>((resolve, reject) => {
    const cleanup = () => {
      a.removeEventListener("ended", onEnd);
      a.removeEventListener("error", onErr);
      if (pending === me) pending = null;
    };
    const onEnd = () => { cleanup(); resolve(); };
    const onErr = () => { cleanup(); reject(new Error("load")); };
    const me = { cancel: () => { cleanup(); reject(new Error("stop")); } };
    pending = me;
    a.addEventListener("ended", onEnd);
    a.addEventListener("error", onErr);
    a.src = src;
    // Safari riporta playbackRate a defaultPlaybackRate quando carica un file nuovo
    a.defaultPlaybackRate = rate;
    a.playbackRate = rate;
    a.play().catch((e: unknown) => {
      // AbortError: un'altra frase è partita prima che questa cominciasse
      if (pending === me && (e as Error)?.name !== "AbortError") onErr();
    });
  });
}

export function stopAudio(): void {
  interrupt();
  shared?.pause();
  owner = null;
  listeners.forEach((f) => f());
}

function useOwner(who: symbol): boolean {
  const [, tick] = useState(0);
  useEffect(() => {
    const f = () => tick((n) => n + 1);
    listeners.add(f);
    return () => { listeners.delete(f); };
  }, []);
  return owner === who;
}

/** ▶ accanto a una frase. */
export function PlayButton({ src, label = "Meghallgatás" }: { src: string; label?: string }) {
  const me = useRef(Symbol("clip")).current;
  const [playing, setPlaying] = useState(false);
  const active = useOwner(me);
  useEffect(() => { if (!active) setPlaying(false); }, [active]);
  const click = () => {
    if (playing) { stopAudio(); setPlaying(false); return; }
    setPlaying(true);
    playClip(src, me).catch(() => {}).finally(() => setPlaying(false));
  };
  return (
    <button type="button" className={`play${playing ? " on" : ""}`} onClick={click} aria-label={playing ? "Leállítás" : label} title={label}>
      {playing ? <IconStop /> : <IconPlay />}
    </button>
  );
}

const SPEEDS = [0.75, 1];

/**
 * Lettore di tutto il dialogo: suona le battute una dopo l'altra, con una pausa breve,
 * e dice quale sta suonando (`onLine`) per evidenziarla.
 */
export function DialoguePlayer({ clips, onLine }: { clips: { n: number; src: string }[]; onLine: (n: number | null) => void }) {
  const me = useRef(Symbol("dialogue")).current;
  const [speed, setSpeed] = useState(1);
  const [loop, setLoop] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [failed, setFailed] = useState(false);
  const run = useRef(0);
  const opts = useRef({ speed, loop });
  opts.current = { speed, loop };
  const active = useOwner(me);

  useEffect(() => {
    if (!active && playing) { run.current++; setPlaying(false); onLine(null); }
  }, [active, playing, onLine]);
  useEffect(() => () => { run.current++; if (owner === me) stopAudio(); }, [me]);

  const start = async (from = 0) => {
    const id = ++run.current;
    setPlaying(true);
    setFailed(false);
    try {
      do {
        for (let i = from; i < clips.length; i++) {
          if (run.current !== id) return;
          onLine(clips[i]!.n);
          await playClip(clips[i]!.src, me, opts.current.speed);
          await new Promise((r) => setTimeout(r, 450));
        }
        from = 0;
      } while (opts.current.loop && run.current === id);
    } catch (e) {
      if ((e as Error).message === "load") setFailed(true);
    } finally {
      if (run.current === id) { setPlaying(false); onLine(null); }
    }
  };

  const stop = () => { run.current++; stopAudio(); setPlaying(false); onLine(null); };

  if (clips.length === 0) return null;
  return (
    <section className="panel player" aria-label="A párbeszéd hangja">
      <button type="button" className="btn primary" onClick={() => (playing ? stop() : void start())}>
        {playing ? <IconStop /> : <IconPlay />}
        {playing ? "Leállítás" : "Az egész párbeszéd"}
      </button>
      <div className="segmented" role="group" aria-label="Sebesség">
        {SPEEDS.map((s) => (
          <button key={s} type="button" aria-pressed={speed === s} onClick={() => setSpeed(s)}>{String(s).replace(".", ",")}×</button>
        ))}
      </div>
      <label className="loop">
        <input type="checkbox" className="switch" checked={loop} onChange={(e) => setLoop(e.target.checked)} />
        Ismétlés
      </label>
      {failed && <p className="notice" style={{ margin: 0, flexBasis: "100%" }}>A hang nem töltődött be. Próbáld újra, vagy frissítsd az alkalmazást.</p>}
    </section>
  );
}

function IconPlay() {
  return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5.5v13l10.5-6.5z" fill="currentColor" /></svg>;
}
function IconStop() {
  return <svg viewBox="0 0 24 24" aria-hidden="true"><rect x="7" y="7" width="10" height="10" rx="1.5" fill="currentColor" /></svg>;
}
