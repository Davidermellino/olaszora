// Testo compatto degli errori, da incollare nella chat del tutor ("Copia per il tutor").
import type { ErrorRow, SessionRow } from "../db/db.ts";
import type { Card, Exercise } from "../types/content.ts";
import type { ErrorType } from "./errorType.ts";

const TYPE_ORDER: ErrorType[] = ["accento", "desinenza", "ordine", "lessico"];
const TYPE_HU: Record<ErrorType, string> = { accento: "ékezet", desinenza: "végződés", ordine: "szórend", lessico: "szókincs" };
const DAY = 86_400_000;

function ddmm(t: number): string {
  const d = new Date(t);
  return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}`;
}

export function buildTutorSummary(
  errors: ErrorRow[],
  sessions: SessionRow[],
  days: number | null,
  now: number,
  topicTitle: (id: string) => string = (id) => id,
): string {
  const since = days === null ? -Infinity : now - days * DAY;
  const errs = errors.filter((e) => e.date >= since).sort((a, b) => a.date - b.date);
  const sess = sessions.filter((s) => s.date >= since);
  const real = errs.filter((e) => !e.override);
  const overridden = errs.filter((e) => e.override);

  const first = Math.min(...[...errs.map((e) => e.date), ...sess.map((s) => s.date)].filter(Number.isFinite), now);
  const period = days === null ? "összes" : `utolsó ${days} nap (${ddmm(Math.max(first, since))}–${ddmm(now)})`;
  const out: string[] = [`Olaszóra · Aréna hibák, ${period}`];

  const grades = sess.flatMap((s) => s.results);
  const c = grades.filter((g) => g.grade === "correct").length;
  const m = grades.filter((g) => g.grade === "minor").length;
  const w = grades.filter((g) => g.grade === "wrong").length;
  out.push(`Gyakorlások: ${sess.length} · válaszok: ${grades.length} (✅ ${c} · 🟡 ${m} · ❌ ${w})`); // taste-skill-ignore: testo per la chat del tutor, non UI

  if (real.length === 0) {
    out.push("Ebben az időszakban nem volt hiba.");
  } else {
    const byType = TYPE_ORDER.map((t) => [t, real.filter((e) => e.type === t).length] as const).filter(([, n]) => n > 0);
    out.push(`Típus szerint: ${byType.map(([t, n]) => `${TYPE_HU[t]} ${n}`).join(" · ")}`);
    const topics = [...new Set(real.map((e) => e.topic))].sort();
    for (const t of topics) {
      const list = real.filter((e) => e.topic === t);
      out.push("", `${t} ${topicTitle(t)} (${list.length})`);
      for (const e of list) {
        out.push(`- ${e.given || "(üres)"} → ${e.expected} [${TYPE_HU[e.type]}${e.grade === "minor" ? ", 🟡" : ""}] ${e.exerciseId} ${ddmm(e.date)}`); // taste-skill-ignore: testo per la chat del tutor
      }
    }
  }
  if (overridden.length) {
    out.push("", `„Jó volt” jelöléssel (${overridden.length}), ellenőrizendő:`);
    for (const e of overridden) out.push(`- ${e.exerciseId}: ${e.given} (várt: ${e.expected})`);
  }
  return out.join("\n");
}

/** La frase italiana completa di un esercizio (per le carte degli errori). */
export function exerciseSentence(ex: Exercise, expected: string): string {
  if (ex.type === "fill" || (ex.type === "mc" && ex.prompt.includes("___"))) {
    const body = ex.prompt.includes(":") ? ex.prompt.slice(ex.prompt.indexOf(":") + 1) : ex.prompt;
    const text = body
      .replace(/\([^)]*\)/g, "")
      .replace("___", expected)
      .replace(/–\s*«[^»]*»/, "")
      .replace(/\s+([.,?!])/g, "$1")
      .replace(/\s+/g, " ")
      .trim();
    return text.charAt(0).toLocaleUpperCase("it") + text.slice(1);
  }
  return expected;
}

/** Carte del mazzo "errori-arena": una per esercizio sbagliato (non ribaltato), la più recente. */
export function errorCards(errors: ErrorRow[], exercises: Map<string, Exercise>): Card[] {
  const latest = new Map<string, ErrorRow>();
  for (const e of errors) if (!e.override && (latest.get(e.exerciseId)?.date ?? -1) < e.date) latest.set(e.exerciseId, e);
  const out: Card[] = [];
  for (const e of [...latest.values()].sort((a, b) => a.date - b.date)) {
    const ex = exercises.get(e.exerciseId);
    if (!ex) continue;
    const it = exerciseSentence(ex, ex.answers[0] ?? e.expected);
    out.push({ id: `err-${e.exerciseId}`, it, hu: ex.hu ?? ex.prompt, tag: "errori-arena", note: ex.rule });
  }
  return out;
}
