import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { arenaById, arenaTopics } from "../content.ts";
import { db } from "../db/instance.ts";
import { saveArenaSession } from "../db/repo.ts";
import { applyOverride, gradeExercise, pickExercises, scoreSession, shuffle, topicOf, type AnswerResult } from "../lib/arena.ts";
import type { CheckResult } from "../lib/checker.ts";
import type { Exercise } from "../types/content.ts";
import { go, href } from "../router.ts";
import { GradeDot, Marked } from "../ui/bits.tsx";
import { IconClose } from "../ui/icons.tsx";
import { PlayButton } from "../ui/audio.tsx";
import { sentenceAudio } from "../lessons.ts";
import { exerciseSentence } from "../lib/tutor.ts";

export const ACCENTS = ["à", "è", "é", "ì", "ò", "ù"];
const KIND: Record<Exercise["type"], string> = { mc: "Válassz", fill: "Egészítsd ki", transform: "Alakítsd át", translate: "Fordítsd le" };

/** "Fordítsd le: Látom." → ["Fordítsd le", "Látom."]. La consegna non contiene mai il buco ___ né parentesi. */
function splitPrompt(p: string): [string | null, string] {
  const m = p.match(/^([^_(«„]{3,60}?[:?])\s+(.+)$/s);
  if (!m) return [null, p];
  return [m[1]!.replace(/:$/, ""), m[2]!];
}

function PromptText({ text }: { text: string }) {
  const parts = text.split("___");
  return (
    <>
      {parts.map((p, i) => (
        <span key={i}>
          {p}
          {i < parts.length - 1 && <span className="slot" aria-label="kitöltendő hely">&nbsp;</span>}
        </span>
      ))}
    </>
  );
}

export function ArenaSession({ topic }: { topic: string }) {
  const topics = topic === "torna" ? arenaTopics : arenaById.has(topic) ? [arenaById.get(topic)!] : [];
  const [round, setRound] = useState(0);
  if (topics.length === 0) {
    return (
      <div className="session">
        <div className="session-bar"><a className="icon-btn" href={href("arena")} aria-label="Bezárás"><IconClose /></a></div>
        <div className="session-body"><h1>Nincs feladat: {topic}</h1><p className="muted">Ehhez a témakörhöz még nincsenek feladatok.</p></div>
        <div className="session-foot"><a className="btn primary big block" href={href("arena")}>Vissza az Arénába</a></div>
      </div>
    );
  }
  return <Round key={round} topicIds={topics.map((t) => t.id)} label={topic === "torna" ? "Torna" : topic} onAgain={() => setRound((r) => r + 1)} />;
}

function Round({ topicIds, label, onAgain }: { topicIds: string[]; label: string; onAgain: () => void }) {
  const exercises = useMemo(() => pickExercises(topicIds.map((id) => arenaById.get(id)!)), [topicIds]);
  const [idx, setIdx] = useState(0);
  const [input, setInput] = useState("");
  const [result, setResult] = useState<CheckResult | null>(null);
  const [results, setResults] = useState<AnswerResult[]>([]);
  const [finished, setFinished] = useState(false);
  const saved = useRef(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const nextRef = useRef<HTMLButtonElement>(null);

  const ex = exercises[idx]!;
  const options = useMemo(() => (ex.options ? shuffle(ex.options) : []), [ex]);
  const [kind, body] = splitPrompt(ex.prompt);
  const last = results[results.length - 1];

  const save = useCallback(async (list: AnswerResult[]) => {
    if (saved.current || list.length === 0) return;
    saved.current = true;
    await saveArenaSession(db, topicIds, list, Date.now());
  }, [topicIds]);

  const submit = (given: string) => {
    if (result) return;
    const r = gradeExercise(ex, given);
    setResult(r);
    setResults((rs) => [...rs, { exerciseId: ex.id, topic: topicOf(ex.id), given, expected: r.expected, grade: r.grade }]);
    setTimeout(() => nextRef.current?.focus(), 0);
  };

  const override = () => setResults((rs) => rs.map((r, i) => (i === rs.length - 1 ? applyOverride(r) : r)));

  const next = async () => {
    if (idx + 1 >= exercises.length) {
      await save(results);
      setFinished(true);
      return;
    }
    setIdx(idx + 1);
    setInput("");
    setResult(null);
    setTimeout(() => inputRef.current?.focus(), 0);
  };

  const quit = async () => {
    await save(results);
    go("arena");
  };

  const insert = (ch: string) => {
    const el = inputRef.current;
    if (!el) return setInput((v) => v + ch);
    const start = el.selectionStart ?? input.length;
    const end = el.selectionEnd ?? input.length;
    const v = input.slice(0, start) + ch + input.slice(end);
    setInput(v);
    requestAnimationFrame(() => { el.focus(); el.setSelectionRange(start + ch.length, start + ch.length); });
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") void quit(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  if (finished) return <Summary label={label} results={results} exercises={exercises} onAgain={onAgain} />;

  const progress = ((idx + (result ? 1 : 0)) / exercises.length) * 100;

  return (
    <div className="session">
      <div className="session-bar">
        <button className="icon-btn" onClick={() => void quit()} aria-label="Bezárás: a megadott válaszok mentésre kerülnek"><IconClose /></button>
        <div className="progress" role="progressbar" aria-valuemin={0} aria-valuemax={exercises.length} aria-valuenow={idx + (result ? 1 : 0)} aria-label="Haladás">
          <span style={{ width: `${progress}%` }} />
        </div>
        <span className="count">{idx + 1}/{exercises.length}</span>
      </div>

      <div className="session-body" style={{ justifyContent: "flex-start" }}>
        <p className="prompt-kind">{label !== topicOf(ex.id) ? `${topicOf(ex.id)} · ` : `${label} · `}{kind ?? KIND[ex.type]}</p>
        <h1 className="prompt" lang={ex.type === "translate" ? "hu" : "it"}><PromptText text={body} /></h1>

        <div style={{ marginTop: 24, display: "grid", gap: 12 }}>
          {ex.type === "mc" ? (
            <div className="options" role="group" aria-label="Lehetőségek">
              {options.map((o) => {
                const picked = last?.exerciseId === ex.id && last.given === o;
                const isRight = !!result && ex.answers.includes(o);
                return (
                  <button key={o} className={`option${result && isRight ? " right" : ""}${result && picked && !isRight ? " picked-wrong" : ""}`} onClick={() => submit(o)} disabled={!!result} lang="it">
                    {o}
                  </button>
                );
              })}
            </div>
          ) : (
            <form onSubmit={(e) => { e.preventDefault(); if (result) void next(); else if (input.trim()) submit(input); }} style={{ display: "grid", gap: 10 }}>
              <label className="sr-only" htmlFor="answer">A válaszod</label>
              <input id="answer" ref={inputRef} className="answer-input" lang="it" value={input} onChange={(e) => setInput(e.target.value)} disabled={!!result}
                autoFocus autoComplete="off" autoCorrect="off" autoCapitalize="off" spellCheck={false} enterKeyHint={result ? "next" : "done"} placeholder="Írd olaszul" />
              {!result && (
                <div className="accents" role="group" aria-label="Ékezetes betűk">
                  {ACCENTS.map((a) => (
                    <button key={a} type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => insert(a)} aria-label={`${a} beszúrása`}>{a}</button>
                  ))}
                </div>
              )}
            </form>
          )}

          {result && last && <Feedback ex={ex} result={result} answer={last} onOverride={override} />}
        </div>
      </div>

      <div className="session-foot">
        {result ? (
          <button ref={nextRef} className="btn primary big block" onClick={() => void next()}>
            {idx + 1 >= exercises.length ? "Eredmény" : "Tovább"}
          </button>
        ) : ex.type !== "mc" ? (
          <button className="btn primary big block" onClick={() => input.trim() && submit(input)} disabled={!input.trim()}>Ellenőrzés</button>
        ) : null}
      </div>
    </div>
  );
}

function Feedback({ ex, result, answer, onOverride }: { ex: Exercise; result: CheckResult; answer: AnswerResult; onOverride: () => void }) {
  const g = answer.override ? "correct" : result.grade;
  const title = answer.override ? "Helyesnek jelölve" : g === "correct" ? "Helyes" : g === "minor" ? "Hibás ékezet" : "Hibás";
  const audio = sentenceAudio(exerciseSentence(ex, result.expected));
  return (
    <section className="feedback" aria-live="polite">
      <div className="feedback-head">
        <p className={`grade ${g}`}><GradeDot grade={g} />{title}</p>
        {result.grade !== "correct" && !answer.override && (
          <button className="btn ghost" onClick={onOverride}>Jó volt</button>
        )}
      </div>
      <dl>
        {result.grade === "minor" && result.accent && (
          <>
            <div><dt>Ezt írtad</dt><dd><Marked text={result.accent.given} positions={result.accent.positions} /></dd></div>
            <div><dt>Helyesen</dt><dd><Marked className="expected" text={result.accent.expected} positions={result.accent.positions} /></dd></div>
          </>
        )}
        {result.grade === "wrong" && (
          <>
            {ex.type !== "mc" && <div><dt>Ezt írtad</dt><dd className="diff muted">{answer.given}</dd></div>}
            <div><dt>Helyes válasz</dt><dd className="expected" lang="it">{result.expected}</dd></div>
          </>
        )}
        {result.grade !== "correct" && (
          <div><dt>Szabály</dt><dd><span className="rule">{ex.rule}</span>{ex.explanation && <span className="muted" style={{ display: "block", marginTop: 4 }}>{ex.explanation}</span>}</dd></div>
        )}
        {ex.answers.length > 1 && result.grade !== "wrong" && (
          <div><dt>Ezek is jók</dt><dd className="muted" lang="it">{ex.answers.filter((a) => a !== result.expected).join(" · ")}</dd></div>
        )}
        {ex.hu && <div><dt>Fordítás</dt><dd lang="hu">{ex.hu}</dd></div>}
        {audio && <div><dt>Kiejtés</dt><dd><PlayButton src={audio} label="A mondat meghallgatása" /></dd></div>}
      </dl>
    </section>
  );
}

function Summary({ label, results, exercises, onAgain }: { label: string; results: AnswerResult[]; exercises: Exercise[]; onAgain: () => void }) {
  const s = scoreSession(results);
  const misses = results.filter((r) => r.grade !== "correct");
  const exById = new Map(exercises.map((e) => [e.id, e]));
  const overrides = results.filter((r) => r.override).length;
  return (
    <div className="session">
      <div className="session-bar">
        <a className="icon-btn" href={href("arena")} aria-label="Bezárás"><IconClose /></a>
        <div className="progress"><span style={{ width: "100%" }} /></div>
        <span className="count">{results.length}/{exercises.length}</span>
      </div>
      <div className="session-body" style={{ justifyContent: "flex-start", gap: 20 }}>
        <div>
          <h1>{label} · a kör véget ért</h1>
          <p className="score" style={{ marginTop: 12 }}>
            <span className="big">{String(s.outOf10).replace(".", ",")}</span>
            <span className="muted">/10 · {s.max} pontból {s.points}</span>
          </p>
          <p className="tally" style={{ marginTop: 8 }}>
            <span><GradeDot grade="correct" />{s.correct} helyes</span>
            <span><GradeDot grade="minor" />{s.minor} ékezet</span>
            <span><GradeDot grade="wrong" />{s.wrong} hibás</span>
          </p>
          <p className="muted" style={{ marginTop: 8 }}>
            {s.outOf10 >= 8 ? "8 vagy több: megszerzett BOSS." : "8 alatt: a témakör sorban marad."}
            {overrides ? ` ${overrides} válasz kézzel javítva („Jó volt”).` : ""}
          </p>
        </div>
        {misses.length > 0 && (
          <section className="panel">
            <header><h2>Átnézendő</h2><span className="meta">Bekerülnek „Az Aréna hibái” pakliba is</span></header>
            <ul className="rows">
              {misses.map((r) => {
                const ex = exById.get(r.exerciseId);
                return (
                  <li key={r.exerciseId} className="row" style={{ alignItems: "flex-start" }}>
                    <span style={{ paddingTop: 7 }}><GradeDot grade={r.grade} /></span>
                    <span className="grow">
                      <span className="line1" style={{ flexWrap: "wrap" }}>
                        <span className="muted" style={{ textDecoration: "line-through" }}>{r.given || "(üres)"}</span>
                        <span className="muted">→</span>
                        <span style={{ fontWeight: 500 }} lang="it">{r.expected}</span>
                      </span>
                      <span className="line2">{ex?.rule}</span>
                    </span>
                  </li>
                );
              })}
            </ul>
          </section>
        )}
      </div>
      <div className="session-foot">
        <button className="btn primary big block" onClick={onAgain}>Még 10 feladat</button>
        <a className="btn secondary big block" href={href("arena")}>Vissza az Arénába</a>
      </div>
    </div>
  );
}
