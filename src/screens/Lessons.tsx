import { useLiveQuery } from "dexie-react-hooks";
import { useCallback, useRef, useState } from "react";
import { asTab, hasAudio, hasTab, lessonById, lineAudio, lessons, lessonsFor, spokenLines, TABS, type LessonTab } from "../lessons.ts";
import { fillParts, inline, plain, type Block, type ExerciseSet, type Lesson, type Pair, type Section, type Word } from "../lib/lessons.ts";
import { checkAnswer, type Grade } from "../lib/checker.ts";
import { db } from "../db/instance.ts";
import { lessonsDone, setLessonDone } from "../db/repo.ts";
import { href } from "../router.ts";
import { plural } from "../ui/bits.tsx";
import { PhoneBrand } from "../ui/Mark.tsx";
import { DialoguePlayer, PlayButton } from "../ui/audio.tsx";
import { ACCENTS } from "./ArenaSession.tsx";

/** I ripassi hanno il titolo «Ripasso»: si mostra «Ismétlés N». */
function lessonTitle(l: Lesson): string {
  return l.review ? `Ismétlés ${Math.round(l.n / 7)}` : l.titleIt;
}

function Tabs({ current, to }: { current: LessonTab; to: (t: LessonTab) => string | null }) {
  return (
    <nav className="tabs" aria-label="A leckék részei">
      {TABS.map((t) => {
        const link = to(t.id);
        return link ? <a key={t.id} href={link} aria-current={current === t.id ? "page" : undefined}>{t.label}</a> : null;
      })}
    </nav>
  );
}

function useDone(): string[] {
  return useLiveQuery(() => lessonsDone(db), [], []);
}

// ---------- elenco ----------

export function LessonList({ tab: rawTab }: { tab: string | undefined }) {
  const tab = asTab(rawTab);
  const rows = lessonsFor(tab);
  const reviews = rows.filter((l) => l.review);
  const audio = lessons.filter(hasAudio).length;
  const done = useDone();

  const row = (l: Lesson) => {
    let line2 = l.titleHu;
    let end = "";
    if (tab === "dialogusok") end = `${l.lines.length} mondat`;
    if (tab === "gyakorlatok") {
      line2 = l.exercises.map((e) => (e.kind === "fill" ? "Egészítse ki" : e.review ? "Ismétlő gyakorlat" : "Fordítsa le")).join(" · ");
      end = `${l.exercises.reduce((s, e) => s + e.items.length, 0)} mondat`;
    }
    if (tab === "nyelvtan") {
      line2 = l.review ? l.grammar.map((s) => s.title.replace(/^\d+\.\s*/, "")).join(" · ") : l.titleHu;
      end = l.review ? `${l.grammar.length} fejezet` : `${noteCount(l)} jegyzet`;
    }
    const isDone = done.includes(l.id);
    return (
      <li key={l.id}>
        <a className="row" href={href("leckek", tab, l.id)}>
          <span className="topic-id">{l.id}</span>
          <span className="grow">
            <span className="line1"><span className="title truncate" lang={l.review ? "hu" : "it"}>{lessonTitle(l)}</span></span>
            <span className="line2 truncate">{line2}</span>
          </span>
          {isDone && <span className="pill pos">Kész</span>}
          <span className="end num muted">{end}</span>
        </a>
      </li>
    );
  };

  return (
    <>
      <div className="title-row">
        <div>
          <PhoneBrand />
          <h1>Leckék</h1>
          <p className="sub">{plural(lessons.length, "lecke", "lecke")} · {done.length} kész · {audio} hanggal</p>
        </div>
      </div>
      <Tabs current={tab} to={(t) => href("leckek", t)} />
      <div className="grid">
        {tab === "nyelvtan" ? (
          <>
            <section className="panel span-6">
              <header><h2>Ismétlések</h2><span className="meta">Hetente egy</span></header>
              <ul className="rows">{reviews.map(row)}</ul>
            </section>
            <section className="panel span-6">
              <header><h2>A leckék jegyzetei</h2><span className="meta">{rows.length - reviews.length} lecke</span></header>
              <ul className="rows">{rows.filter((l) => !l.review).map(row)}</ul>
            </section>
          </>
        ) : (
          <section className="panel span-12">
            <header>
              <h2>{tab === "dialogusok" ? "Dialógusok" : "Gyakorlatok"}</h2>
              <span className="meta">{rows.length} lecke</span>
            </header>
            <ul className="rows two-col">{rows.map(row)}</ul>
          </section>
        )}
      </div>
    </>
  );
}

function noteCount(l: Lesson): number {
  const first = l.notes[0]?.blocks.find((b) => b.kind === "list");
  return first && first.kind === "list" ? first.items.filter((i) => i.depth === 0).length : l.notes.length;
}

// ---------- una lezione ----------

export function LessonScreen({ tab: rawTab, id }: { tab: string | undefined; id: string }) {
  const lesson = lessonById.get(id);
  const tab = asTab(rawTab);
  const done = useDone();
  if (!lesson) {
    return (
      <>
        <div className="title-row"><div><a className="back" href={href("leckek")}>Leckék</a><h1>{id}</h1></div></div>
        <p className="empty">Ez a lecke még nincs meg.</p>
      </>
    );
  }
  const list = lessonsFor(tab);
  const at = list.indexOf(lesson);
  const prev = at > 0 ? list[at - 1] : undefined;
  const next = at >= 0 ? list[at + 1] : undefined;
  const isDone = done.includes(lesson.id);

  return (
    <>
      <div className="title-row">
        <div>
          <a className="back" href={href("leckek", tab)}>Leckék</a>
          <h1><span className="muted num">{lesson.id}</span> · <span lang={lesson.review ? "hu" : "it"}>{lessonTitle(lesson)}</span></h1>
          <p className="sub">{[lesson.ordinal && <span key="o" lang="it">{lesson.ordinal}</span>, lesson.review ? null : lesson.titleHu].filter(Boolean).flatMap((x, i) => (i ? [" · ", x] : [x]))}</p>
        </div>
        <div className="actions">
          <button className={`btn ${isDone ? "secondary" : "primary"}`} onClick={() => void setLessonDone(db, lesson.id, !isDone)} aria-pressed={isDone}>
            {isDone ? "✓ Kész" : "Késznek jelölöm"}
          </button>
        </div>
      </div>
      <Tabs current={tab} to={(t) => (hasTab(lesson, t) ? href("leckek", t, lesson.id) : null)} />

      {/* key: cambiando lezione o sezione si riparte da capo */}
      <div className="lesson" key={`${lesson.id}/${tab}`}>
        {tab === "dialogusok" && <Dialogue lesson={lesson} />}
        {tab === "gyakorlatok" && (lesson.exercises.length ? lesson.exercises.map((e) => <Exercise key={e.title} set={e} lesson={lesson} />) : <p className="empty">Ehhez a leckéhez nincsenek gyakorlatok.</p>)}
        {tab === "nyelvtan" && <Sections sections={lesson.review ? lesson.grammar : lesson.notes} lead={lesson.review ? lesson.lead : []} />}

        <div className="pager">
          {prev ? <a className="btn secondary" href={href("leckek", tab, prev.id)}>← {prev.id}</a> : <span />}
          {next && <a className="btn secondary" href={href("leckek", tab, next.id)}>{next.id} →</a>}
        </div>
      </div>
    </>
  );
}

/** Battute con audio e lettore: usato dal dialogo e dall'esercizio di ripasso. */
function useSpoken(lesson: Lesson) {
  const [current, setCurrent] = useState<number | null>(null);
  const clips = spokenLines(lesson).flatMap((p) => {
    const src = lineAudio(lesson, p.n);
    return src ? [{ n: p.n, src }] : [];
  });
  const onLine = useCallback((n: number | null) => setCurrent(n), []);
  return { current, clips, onLine, src: (n: number) => lineAudio(lesson, n) };
}

function Dialogue({ lesson }: { lesson: Lesson }) {
  const [showAll, setShowAll] = useState(true);
  const [open, setOpen] = useState<Set<number>>(new Set());
  const reveal = (n: number) => setOpen((s) => new Set(s).add(n));
  const spoken = useSpoken(lesson);
  return (
    <>
      {lesson.lead.map((t) => <p key={t} className="notice">{t}</p>)}
      {spoken.clips.length > 0
        ? <DialoguePlayer clips={spoken.clips} onLine={spoken.onLine} />
        : <p className="notice">Ehhez a leckéhez még nincs hang.</p>}
      {lesson.lines.length > 0 && (
        <section className="panel">
          <header>
            <h2>Párbeszéd</h2>
            <div className="segmented" role="group" aria-label="Fordítás">
              <button type="button" aria-pressed={showAll} onClick={() => setShowAll(true)}>Fordítással</button>
              <button type="button" aria-pressed={!showAll} onClick={() => { setShowAll(false); setOpen(new Set()); }}>Csak olaszul</button>
            </div>
          </header>
          <Lines lines={lesson.lines} current={spoken.current} src={spoken.src} show={(n) => showAll || open.has(n)} reveal={reveal} />
        </section>
      )}
      <Sections sections={lesson.notes} lead={[]} />
      {lesson.words.length > 0 && <Words words={lesson.words} />}
    </>
  );
}

function Lines({ lines, current, src, show, reveal }: {
  lines: Pair[];
  current: number | null;
  src: (n: number) => string | null;
  show: (n: number) => boolean;
  reveal: (n: number) => void;
}) {
  return (
    <ol className="dialogue">
      {lines.map((p) => {
        const s = src(p.n);
        return (
          <li key={p.n} className={current === p.n ? "speaking" : undefined}>
            <span className="n">{s ? <PlayButton src={s} label={`${p.n}. mondat meghallgatása`} /> : p.n}</span>
            {p.who && <span className="who" lang="it">{p.who}</span>}
            <span className="tgt" lang="it"><Inline text={p.it} /></span>
            {show(p.n)
              ? <span className="tr" lang="hu"><Inline text={p.hu} /></span>
              : <button type="button" className="tr" onClick={() => reveal(p.n)}>Fordítás</button>}
          </li>
        );
      })}
    </ol>
  );
}

function Words({ words }: { words: Word[] }) {
  return (
    <section className="panel">
      <header><h2>Szavak</h2><span className="meta">{words.length} kártya a pakliban</span></header>
      <div className="table-wrap">
        <table>
          <thead><tr><th>Olaszul</th><th>Magyarul</th></tr></thead>
          <tbody>{words.map((w) => <tr key={w.id}><td lang="it"><strong>{w.it}</strong></td><td lang="hu">{w.hu}</td></tr>)}</tbody>
        </table>
      </div>
    </section>
  );
}

function Exercise({ set, lesson }: { set: ExerciseSet; lesson: Lesson }) {
  if (set.kind === "fill") return <FillExercise set={set} />;
  return set.review ? <ReviewExercise set={set} lesson={lesson} /> : <TranslateExercise set={set} />;
}

/** Esercizio di ripasso: come il dialogo, con l'audio e la traduzione da scoprire. */
function ReviewExercise({ set, lesson }: { set: ExerciseSet; lesson: Lesson }) {
  const [open, setOpen] = useState<Set<number>>(new Set());
  const spoken = useSpoken(lesson);
  const all = open.size === set.items.length;
  return (
    <>
      {spoken.clips.length > 0 && <DialoguePlayer clips={spoken.clips} onLine={spoken.onLine} />}
      <section className="panel">
        <header>
          <h2>{set.title}</h2>
          <button type="button" className="card-link" onClick={() => setOpen(all ? new Set() : new Set(set.items.map((p) => p.n)))}>
            {all ? "Fordítások elrejtése" : "Mind mutasd"}
          </button>
        </header>
        <Lines lines={set.items} current={spoken.current} src={spoken.src} show={(n) => open.has(n)} reveal={(n) => setOpen((s) => new Set(s).add(n))} />
      </section>
    </>
  );
}

/** Si legge l'italiano, poi si scopre la traduzione. */
function TranslateExercise({ set }: { set: ExerciseSet }) {
  const [open, setOpen] = useState<Set<number>>(new Set());
  const all = open.size === set.items.length;
  return (
    <section className="panel">
      <header>
        <h2>{set.title}</h2>
        <button type="button" className="card-link" onClick={() => setOpen(all ? new Set() : new Set(set.items.map((p) => p.n)))}>
          {all ? "Fordítások elrejtése" : "Mind mutasd"}
        </button>
      </header>
      <ol className="dialogue">
        {set.items.map((p) => (
          <li key={p.n}>
            <span className="n">{p.n}</span>
            <span className="tgt" lang="it"><Inline text={p.it} /></span>
            {open.has(p.n)
              ? <span className="tr" lang="hu"><Inline text={p.hu} /></span>
              : <button type="button" className="tr" onClick={() => setOpen((s) => new Set(s).add(p.n))}>Fordítás</button>}
          </li>
        ))}
      </ol>
    </section>
  );
}

/** Si completa la frase italiana: un campo per ogni buco. */
function FillExercise({ set }: { set: ExerciseSet }) {
  const [values, setValues] = useState<Record<string, string>>({});
  const [checked, setChecked] = useState(false);
  const focused = useRef<HTMLInputElement | null>(null);
  const items = set.items.map((p) => ({ ...p, parts: fillParts(p.it) }));
  const blanks = items.flatMap((p) => p.parts.map((part, i) => ({ key: `${p.n}-${i}`, part })).filter((x) => x.part.blank));
  const grade = (key: string, answer: string): Grade => checkAnswer(values[key] ?? "", [answer]).grade;
  const right = blanks.filter((b) => grade(b.key, b.part.text) !== "wrong").length;
  const filled = blanks.some((b) => (values[b.key] ?? "").trim());

  const insert = (ch: string) => {
    const el = focused.current;
    if (!el || checked) return;
    const key = el.dataset.key!;
    const start = el.selectionStart ?? el.value.length;
    const end = el.selectionEnd ?? start;
    setValues((v) => ({ ...v, [key]: el.value.slice(0, start) + ch + el.value.slice(end) }));
    requestAnimationFrame(() => { el.focus(); el.setSelectionRange(start + ch.length, start + ch.length); });
  };

  return (
    <section className="panel">
      <header>
        <h2>{set.title}</h2>
        {checked && <span className="meta num">{right}/{blanks.length} jó</span>}
      </header>
      <form onSubmit={(e) => { e.preventDefault(); if (filled) setChecked(true); }}>
        <ol className="dialogue">
          {items.map((p) => {
            const wrong = checked && p.parts.some((part, i) => part.blank && grade(`${p.n}-${i}`, part.text) !== "correct");
            return (
              <li key={p.n}>
                <span className="n">{p.n}</span>
                <span className="tgt" lang="it">
                  {p.parts.map((part, i) => {
                    const key = `${p.n}-${i}`;
                    if (!part.blank) return <span key={key}>{part.text}</span>;
                    return (
                      <input key={key} data-key={key} className={`gap ${checked ? grade(key, part.text) : ""}`} lang="it"
                        style={{ width: `${Math.max(3, [...part.text].length + 2)}ch` }}
                        value={values[key] ?? ""} readOnly={checked}
                        onChange={(e) => setValues((v) => ({ ...v, [key]: e.target.value }))}
                        onFocus={(e) => { focused.current = e.currentTarget; }}
                        aria-label={`${p.n}. mondat, hiányzó szó`}
                        autoComplete="off" autoCorrect="off" autoCapitalize="off" spellCheck={false} enterKeyHint="done" />
                    );
                  })}
                </span>
                <span className="tr" lang="hu"><Inline text={p.hu} /></span>
                {wrong && <span className="tr bad" lang="it">Helyesen: <strong>{plain(p.it)}</strong></span>}
              </li>
            );
          })}
        </ol>
        <div className="ex-foot">
          {!checked && (
            <div className="accents" role="group" aria-label="Ékezetes betűk">
              {ACCENTS.map((a) => (
                <button key={a} type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => insert(a)} aria-label={`${a} beszúrása`}>{a}</button>
              ))}
            </div>
          )}
          {checked ? (
            <button type="button" className="btn secondary" onClick={() => { setValues({}); setChecked(false); }}>Újra</button>
          ) : (
            <>
              <button type="submit" className="btn primary" disabled={!filled}>Ellenőrzés</button>
              <button type="button" className="btn ghost" onClick={() => { setValues(Object.fromEntries(blanks.map((b) => [b.key, b.part.text]))); setChecked(true); }}>Megoldások</button>
            </>
          )}
        </div>
      </form>
    </section>
  );
}

// ---------- testo delle note e della grammatica ----------

function Sections({ sections, lead }: { sections: Section[]; lead: string[] }) {
  return (
    <>
      {lead.map((t) => <p key={t} className="notice">{t}</p>)}
      {sections.map((s) => (
        <section key={s.title} className="panel">
          <header><h2>{s.title}</h2></header>
          <div className="prose">{s.blocks.map((b, i) => <BlockView key={i} block={b} />)}</div>
        </section>
      ))}
    </>
  );
}

function BlockView({ block }: { block: Block }) {
  if (block.kind === "h") return <h3>{block.text}</h3>;
  if (block.kind === "p") return <p><Inline text={block.text} /></p>;
  if (block.kind === "list") {
    const List = block.ordered ? "ol" : "ul";
    let n = 0;
    return (
      <List>
        {block.items.map((it, i) => {
          const top = it.depth === 0;
          if (top) n++;
          return (
            <li key={i} id={block.ordered && top ? `jegyzet-${n}` : undefined} style={{ marginLeft: it.depth * 24 }}>
              <span className="bullet">{block.ordered && top ? `${n}.` : "–"}</span>
              <span><Inline text={it.text} /></span>
            </li>
          );
        })}
      </List>
    );
  }
  return (
    <div className="table-wrap">
      <table>
        <thead><tr>{block.head.map((c, i) => <th key={i}><Inline text={c} /></th>)}</tr></thead>
        <tbody>
          {block.rows.map((r, i) => <tr key={i}>{r.map((c, j) => <td key={j}><Inline text={c} /></td>)}</tr>)}
        </tbody>
      </table>
    </div>
  );
}

function Inline({ text }: { text: string }) {
  return (
    <>
      {inline(text).map((s, i) => {
        if (s.note !== undefined) {
          return (
            <sup key={i} className="note-ref">
              <a href={`#jegyzet-${s.note}`} onClick={(e) => { e.preventDefault(); document.getElementById(`jegyzet-${s.note}`)?.scrollIntoView({ behavior: "smooth", block: "center" }); }} aria-label={`${s.note}. jegyzet`}>{s.note}</a>
            </sup>
          );
        }
        const inner = s.italic ? <em>{s.text}</em> : s.text;
        return s.bold ? <strong key={i}>{inner}</strong> : <span key={i}>{inner}</span>;
      })}
    </>
  );
}
