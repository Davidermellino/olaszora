import { useLiveQuery } from "dexie-react-hooks";
import { useState } from "react";
import { arenaById } from "../content.ts";
import { useNow, useToast } from "../data.ts";
import { db } from "../db/instance.ts";
import { recentErrors } from "../db/repo.ts";
import type { ErrorRow } from "../db/db.ts";
import { checkAnswer } from "../lib/checker.ts";
import type { ErrorType } from "../lib/errorType.ts";
import { buildTutorSummary } from "../lib/tutor.ts";
import { GradeDot, Marked, plural, relativeDay, TYPE_LABEL } from "../ui/bits.tsx";
import { IconCopy } from "../ui/icons.tsx";
import { PhoneBrand } from "../ui/Mark.tsx";

const PERIODS = [{ days: 7, label: "7 nap" }, { days: 30, label: "30 nap" }, { days: null, label: "Mind" }] as const;
const TYPES: ErrorType[] = ["accento", "desinenza", "ordine", "lessico"];
const DAY = 86_400_000;

function topicTitle(id: string): string {
  return arenaById.get(id)?.title ?? "";
}

export function Errors() {
  const now = useNow();
  const [days, setDays] = useState<number | null>(7);
  const [group, setGroup] = useState<"topic" | "type">("topic");
  const [toast, showToast] = useToast();
  const all = useLiveQuery(() => recentErrors(db), []);
  const sessions = useLiveQuery(() => db.sessions.toArray(), [], []);

  const since = days === null ? -Infinity : now - days * DAY;
  const inPeriod = (all ?? []).filter((e) => e.date >= since);
  const real = inPeriod.filter((e) => !e.override);
  const byType = TYPES.map((t) => ({ t, n: real.filter((e) => e.type === t).length }));
  const top = [...byType].sort((a, b) => b.n - a.n)[0];

  const groups: { key: string; title: string; rows: ErrorRow[] }[] =
    group === "topic"
      ? [...new Set(inPeriod.map((e) => e.topic))].sort().map((t) => ({ key: t, title: `${t} ${topicTitle(t)}`, rows: inPeriod.filter((e) => e.topic === t) }))
      : TYPES.filter((t) => inPeriod.some((e) => e.type === t && !e.override)).map((t): { key: string; title: string; rows: ErrorRow[] } => ({ key: t, title: TYPE_LABEL[t], rows: inPeriod.filter((e) => e.type === t && !e.override) }))
          .concat(inPeriod.some((e) => e.override) ? [{ key: "override", title: "Kézzel javítva", rows: inPeriod.filter((e) => e.override) }] : []);

  const copy = async () => {
    const text = buildTutorSummary(all ?? [], sessions, days, Date.now(), topicTitle);
    try {
      await navigator.clipboard.writeText(text);
      showToast("Kimásolva: illeszd be a tanárodnak küldött üzenetbe");
    } catch {
      showToast("A másolás nem sikerült");
    }
  };

  const periodLabel = days === null ? "összesen" : `az utolsó ${days} napban`;

  return (
    <>
      <div className="title-row">
        <div>
          <PhoneBrand />
          <h1>Hibák</h1>
          <p className="sub">
            {all === undefined ? "" : real.length === 0 ? `Nincs hiba ${periodLabel}.` : `${plural(real.length, "hiba", "hiba")} ${periodLabel}${top && top.n > 0 ? ` · a leggyakoribb: ${TYPE_LABEL[top.t].toLowerCase()}` : ""}.`}
          </p>
        </div>
        <div className="actions">
          <button className="btn primary" onClick={() => void copy()} disabled={!all || inPeriod.length === 0}>
            <IconCopy />Másolás a tanárnak
          </button>
        </div>
      </div>

      <div className="toolbar">
        <div className="segmented" role="group" aria-label="Időszak">
          {PERIODS.map((p) => (
            <button key={p.label} aria-pressed={days === p.days} onClick={() => setDays(p.days)}>{p.label}</button>
          ))}
        </div>
        <div className="segmented" role="group" aria-label="Csoportosítás">
          <button aria-pressed={group === "topic"} onClick={() => setGroup("topic")}>Témakör szerint</button>
          <button aria-pressed={group === "type"} onClick={() => setGroup("type")}>Típus szerint</button>
        </div>
      </div>

      <section className="panel" style={{ marginBottom: "var(--gap)" }}>
        <header><h2>Típus szerint</h2><span className="meta">{days === null ? "Kezdettől" : `Utolsó ${days} nap`}</span></header>
        <div className="kpis" style={{ marginTop: 0 }}>
          {byType.map(({ t, n }) => (
            <div key={t} className="kpi">
              <p className="kpi-label">{TYPE_LABEL[t]}</p>
              <p className="kpi-value" style={{ color: n === 0 ? "var(--muted)" : undefined }}>{n}</p>
            </div>
          ))}
        </div>
      </section>

      {all !== undefined && groups.length === 0 ? (
        <p className="empty">Nincs hiba {periodLabel}. Az Aréna feladatai után itt látod, mit érdemes átnézni.</p>
      ) : (
        <div className="stack">
          {groups.map((g) => (
            <section key={g.key} className="panel">
              <header><h2>{g.title}</h2><span className="meta num">{g.rows.length}</span></header>
              <ul className="rows">
                {g.rows.map((e) => <ErrorItem key={e.id} e={e} now={now} showTopic={group === "type"} />)}
              </ul>
            </section>
          ))}
        </div>
      )}
      {toast && <div className="toast" role="status">{toast}</div>}
    </>
  );
}

function ErrorItem({ e, now, showTopic }: { e: ErrorRow; now: number; showTopic: boolean }) {
  const acc = e.grade === "minor" ? checkAnswer(e.given, [e.expected]).accent : undefined;
  return (
    <li className="row" style={{ alignItems: "flex-start" }}>
      <span style={{ paddingTop: 9 }}><GradeDot grade={e.override ? "correct" : e.grade} /></span>
      <span className="grow">
        <span className="line1" style={{ flexWrap: "wrap", columnGap: 10 }}>
          {acc ? (
            <Marked text={acc.given} positions={acc.positions} />
          ) : (
            <span className="diff muted" style={{ textDecoration: e.override ? "none" : "line-through" }} lang="it">{e.given || "(üres)"}</span>
          )}
          <span className="muted">→</span>
          {acc ? <Marked className="expected" text={acc.expected} positions={acc.positions} /> : <span className="diff" style={{ fontWeight: 500 }} lang="it">{e.expected}</span>}
        </span>
        <span className="line2">
          {showTopic ? `${e.topic} · ` : ""}{e.override ? "Kézzel javítva" : TYPE_LABEL[e.type]} · {relativeDay(e.date, now)} · {e.exerciseId}
        </span>
      </span>
    </li>
  );
}
