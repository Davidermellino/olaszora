import { useCallback, useEffect, useMemo, useState } from "react";
import { deckName } from "../content.ts";
import { useAllCards } from "../data.ts";
import { db } from "../db/instance.ts";
import { answerCard, studyContext } from "../db/repo.ts";
import { previewIntervals, type Rating, type SrsState, newState } from "../lib/srs.ts";
import { extraAvailable, nextAhead, nextItem, summarize, type StudyItem } from "../lib/study.ts";
import { go, href } from "../router.ts";
import { plural } from "../ui/bits.tsx";
import { IconClose } from "../ui/icons.tsx";
import { PlayButton } from "../ui/audio.tsx";
import { sentenceAudio } from "../lessons.ts";

const RATINGS: { r: Rating; label: string; key: string }[] = [
  { r: 1, label: "Újra", key: "1" },
  { r: 2, label: "Nehéz", key: "2" },
  { r: 3, label: "Jó", key: "3" },
  { r: 4, label: "Könnyű", key: "4" },
];

interface View {
  item: StudyItem | null;
  state: SrsState;
  remaining: number;
  nextDueIn: number | null;
  introduced: number;
  unseen: number;
  ahead: number;
}

/** Carte nuove in più per ogni «Még 5 új kártya». */
const EXTRA_NEW = 5;

export function Review({ deck }: { deck: string }) {
  const all = useAllCards();
  const cards = useMemo(() => (deck === "osszes" ? all : all.filter((c) => c.tag === deck)), [all, deck]);
  const [view, setView] = useState<View | null>(null);
  const [revealed, setRevealed] = useState(false);
  const [answered, setAnswered] = useState(0);
  const [busy, setBusy] = useState(false);
  // Oltre l'obiettivo: tetto di carte nuove di oggi e ripasso in anticipo
  const [newCap, setNewCap] = useState(0);
  const [ahead, setAhead] = useState(false);

  const load = useCallback(async () => {
    const now = Date.now();
    const { states, items, newLeftToday, introduced } = await studyContext(db, cards, now, newCap);
    const item = nextItem(items, states, now, newLeftToday) ?? (ahead ? nextAhead(items, states, now) : null);
    const sum = summarize(items, states, now, newLeftToday);
    const extra = extraAvailable(items, states, now);
    let nextDueIn: number | null = null;
    if (!item) {
      const pending = items.map((i) => states.get(i.key)).filter((s) => s && (s.phase === "learning" || s.phase === "relearning")) as SrsState[];
      if (pending.length) nextDueIn = Math.max(0, Math.min(...pending.map((s) => s.due)) - now);
    }
    setView({
      item,
      state: (item && states.get(item.key)) || newState(),
      remaining: sum.dueToday + sum.newLeft + (ahead ? extra.ahead : 0),
      nextDueIn,
      introduced,
      ...extra,
    });
    setRevealed(false);
  }, [cards, newCap, ahead]);

  useEffect(() => { void load(); }, [load]);

  // Una carta in apprendimento che scade tra poco: riprova quando scade
  useEffect(() => {
    if (!view || view.item || view.nextDueIn === null) return;
    const id = setTimeout(() => void load(), view.nextDueIn + 250);
    return () => clearTimeout(id);
  }, [view, load]);

  const rate = useCallback(async (r: Rating) => {
    if (!view?.item || busy) return;
    setBusy(true);
    await answerCard(db, view.item.key, r, Date.now());
    setAnswered((n) => n + 1);
    await load();
    setBusy(false);
  }, [view, busy, load]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.key === "Escape") go("kartyak");
      if (!view?.item) return;
      if (!revealed && (e.key === " " || e.key === "Enter")) { e.preventDefault(); setRevealed(true); }
      else if (revealed) {
        const hit = RATINGS.find((x) => x.key === e.key);
        if (hit) { e.preventDefault(); void rate(hit.r); }
        if (e.key === " " || e.key === "Enter") { e.preventDefault(); void rate(3); }
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [view, revealed, rate]);

  const progress = view ? (answered / Math.max(1, answered + view.remaining)) * 100 : 0;
  const item = view?.item;
  const front = item ? (item.dir === "it-hu" ? item.card.it : item.card.hu) : "";
  const back = item ? (item.dir === "it-hu" ? item.card.hu : item.card.it) : "";
  const intervals = item && view ? previewIntervals(view.state, Date.now()) : null;
  // ▶ se la parola o la frase italiana coincide con una battuta che ha l'audio
  const audio = item ? sentenceAudio(item.card.it) : null;

  return (
    <div className="session">
      <div className="session-bar">
        <a className="icon-btn" href={href("kartyak")} aria-label="Bezárás"><IconClose /></a>
        <h1>{deck === "osszes" ? "Minden pakli" : deckName(deck)}</h1>
        <div className="progress" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(progress)} aria-label="Haladás">
          <span style={{ width: `${progress}%` }} />
        </div>
        <span className="count" aria-label="Hátralévő kártyák">{view?.remaining ?? ""}</span>
      </div>

      <div className={`session-body${item ? " cardmode" : ""}`}>
        {!view ? null : item ? (
          <button className="flash" onClick={() => setRevealed(true)} aria-expanded={revealed} style={{ cursor: revealed ? "default" : "pointer" }}>
            <span className="side">
              {deck === "osszes" ? deckName(item.card.tag) : item.dir === "it-hu" ? "Olasz → magyar" : "Magyar → olasz"}
              {view.state.phase === "new" ? " · új" : ""}
            </span>
            <span className="word" lang={item.dir === "it-hu" ? "it" : "hu"}>{front}</span>
            {revealed && (
              <span className="answer">
                <span className="word" lang={item.dir === "it-hu" ? "hu" : "it"}>{back}</span>
                {audio && <span onClick={(e) => e.stopPropagation()}><PlayButton src={audio} label="Kiejtés" /></span>}
                {(item.card.exampleHu || item.card.exampleIt) && (
                  <span className="example">
                    {item.card.exampleHu && <span className="hu" lang="hu">{item.card.exampleHu}</span>}
                    {item.card.exampleIt && <span className="muted" lang="it">{item.card.exampleIt}</span>}
                  </span>
                )}
                {item.card.note && <span className="note">{item.card.note}</span>}
              </span>
            )}
          </button>
        ) : (
          <Done answered={answered} view={view} deck={deck} />
        )}
      </div>

      <div className="session-foot">
        {item && !revealed && (
          <button className="btn primary big block" onClick={() => setRevealed(true)}>Válasz mutatása</button>
        )}
        {item && revealed && intervals && (
          <div className="ratings" role="group" aria-label="Mennyire tudtad?">
            {RATINGS.map((x) => (
              <button key={x.r} className={`rating${x.r === 1 ? " again" : ""}`} onClick={() => void rate(x.r)} disabled={busy}>
                {x.label}
                <small>{intervals[x.r]}</small>
              </button>
            ))}
          </div>
        )}
        {!item && view && view.unseen > 0 && (
          <button className="btn primary big block" onClick={() => setNewCap(view.introduced + EXTRA_NEW)}>
            {view.unseen >= EXTRA_NEW ? `Még ${EXTRA_NEW} új kártya` : `Még ${plural(view.unseen, "új kártya", "új kártya")}`}
          </button>
        )}
        {!item && view && view.ahead > 0 && !ahead && (
          <button className={`btn ${view.unseen > 0 ? "secondary" : "primary"} big block`} onClick={() => setAhead(true)}>Előre ismétlés</button>
        )}
        {!item && view && <a className={`btn ${view.unseen > 0 || (view.ahead > 0 && !ahead) ? "ghost" : "primary"} big block`} href={href()}>Vissza a Mához</a>}
      </div>
    </div>
  );
}

function Done({ answered, view, deck }: { answered: number; view: View; deck: string }) {
  const minutes = view.nextDueIn === null ? null : Math.max(1, Math.ceil(view.nextDueIn / 60_000));
  const more = view.unseen > 0 || view.ahead > 0;
  return (
    <div style={{ display: "grid", gap: 8 }}>
      <h2 style={{ fontSize: 20, lineHeight: "28px", fontWeight: 500 }}>{minutes !== null ? "Rövid szünet" : "Napi cél teljesítve"}</h2>
      <p className="muted">
        {answered > 0 ? `${plural(answered, "válasz", "válasz")} ebben a körben` : "A mai kártyák készen vannak"}
        {deck !== "osszes" ? ` („${deckName(deck)}” pakli)` : ""}.
        {minutes !== null
          ? ` Egy tanulás alatt álló kártya ${minutes} perc múlva visszajön: maradj itt, vagy gyere vissza később.`
          : more
            ? " Ha van időd, folytathatod: a plusz kártyák rendes tanulásnak számítanak."
            : " A következő ismétlések holnap jönnek."}
      </p>
    </div>
  );
}
