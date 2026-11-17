import type { Grade } from "../lib/checker.ts";
import type { ErrorType } from "../lib/errorType.ts";

export const GRADE_LABEL: Record<Grade, string> = { correct: "Helyes", minor: "Ékezet", wrong: "Hibás" };
const GRADE_CLASS: Record<Grade, string> = { correct: "pos", minor: "warn", wrong: "neg" };

export function GradePill({ grade, override }: { grade: Grade; override?: boolean }) {
  if (override) return <span className="pill">Kézzel javítva</span>;
  return <span className={`pill ${GRADE_CLASS[grade]}`}>{GRADE_LABEL[grade]}</span>;
}

export function GradeDot({ grade }: { grade: Grade }) {
  return <span className={`dot ${GRADE_CLASS[grade]}`} aria-hidden="true" />;
}

export const TYPE_LABEL: Record<ErrorType, string> = {
  accento: "Ékezet",
  desinenza: "Végződés",
  ordine: "Szórend",
  lessico: "Szókincs",
};

/** Una stringa con alcune posizioni (in caratteri) evidenziate. */
export function Marked({ text, positions, className = "" }: { text: string; positions: number[]; className?: string }) {
  const chars = [...text];
  const set = new Set(positions);
  return (
    <span className={`diff ${className}`}>
      {chars.map((c, i) => (set.has(i) ? <mark key={i}>{c}</mark> : <span key={i}>{c}</span>))}
    </span>
  );
}

const DAY = 86_400_000;
/** "Ma", "Tegnap", "3 napja", poi la data. */
export function relativeDay(t: number, now = Date.now()): string {
  const d0 = new Date(now); d0.setHours(0, 0, 0, 0);
  const d1 = new Date(t); d1.setHours(0, 0, 0, 0);
  const days = Math.round((d0.getTime() - d1.getTime()) / DAY);
  if (days <= 0) return "Ma";
  if (days === 1) return "Tegnap";
  if (days < 7) return `${days} napja`;
  return new Date(t).toLocaleDateString("hu-HU", { month: "short", day: "numeric" });
}

export function todayLabel(now = Date.now()): string {
  return new Date(now).toLocaleDateString("hu-HU", { month: "long", day: "numeric", weekday: "long" });
}

/** "1 kártya" / "3 kártya": in ungherese dopo un numero il nome resta al singolare, ma la funzione resta per i casi diversi. */
export function plural(n: number, one: string, many: string): string {
  return `${n} ${n === 1 ? one : many}`;
}
