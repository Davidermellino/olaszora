// Sessioni Arena (logica pura).
import type { ArenaTopic, Exercise } from "../types/content.ts";
import { checkAnswer, gradePoints, normalize, type CheckResult, type Grade } from "./checker.ts";

export const SESSION_SIZE = 10;

export type Rng = () => number;

export function shuffle<T>(arr: readonly T[], rng: Rng = Math.random): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j]!, a[i]!];
  }
  return a;
}

/**
 * Esercizi per una sessione.
 * - Un argomento: `n` esercizi a caso, senza ripetizioni.
 * - Più argomenti (Torneo): a turno da ciascun argomento, poi mescolati.
 */
export function pickExercises(topics: ArenaTopic[], n = SESSION_SIZE, rng: Rng = Math.random): Exercise[] {
  const pools = shuffle(topics, rng).map((t) => shuffle(t.exercises, rng));
  const out: Exercise[] = [];
  let progressed = true;
  while (out.length < n && progressed) {
    progressed = false;
    for (const pool of pools) {
      const ex = pool.pop();
      if (ex) {
        out.push(ex);
        progressed = true;
        if (out.length === n) break;
      }
    }
  }
  return shuffle(out, rng);
}

/**
 * Corregge la risposta a un esercizio.
 * - mc: si sceglie un'opzione, quindi niente 🟡: o è quella giusta (✅) o è sbagliata (❌).
 *   (e/è sono scelte diverse, non un refuso di accento.)
 * - fill, transform, translate: checkAnswer (✅ / 🟡 / ❌).
 */
export function gradeExercise(ex: Exercise, given: string): CheckResult {
  if (ex.type === "mc") {
    const hit = ex.answers.find((a) => normalize(a) === normalize(given));
    return hit ? { grade: "correct", expected: hit } : { grade: "wrong", expected: ex.answers[0]! };
  }
  return checkAnswer(given, ex.answers);
}

export interface AnswerResult {
  exerciseId: string;
  topic: string;
  given: string;
  expected: string;
  grade: Grade;
  /** "Era giusta": la correzione è stata ribaltata a ✅. */
  override?: boolean;
  /** Voto dato dal checker prima dell'override. */
  originalGrade?: Grade;
}

/** Id argomento da un id esercizio: "A03-007" → "A03". */
export function topicOf(exerciseId: string): string {
  return exerciseId.split("-")[0] ?? exerciseId;
}

/** Ribalta la correzione a ✅ ("Era giusta"). */
export function applyOverride(r: AnswerResult): AnswerResult {
  if (r.override) return r;
  return { ...r, grade: "correct", override: true, originalGrade: r.grade };
}

export interface SessionScore {
  points: number;
  max: number;
  /** Punteggio riportato su 10, come il BOSS. */
  outOf10: number;
  correct: number;
  minor: number;
  wrong: number;
}

export function scoreSession(results: AnswerResult[]): SessionScore {
  const points = results.reduce((s, r) => s + gradePoints(r.grade), 0);
  const max = results.length * 2;
  return {
    points,
    max,
    outOf10: max ? Math.round((points / max) * 100) / 10 : 0,
    correct: results.filter((r) => r.grade === "correct").length,
    minor: results.filter((r) => r.grade === "minor").length,
    wrong: results.filter((r) => r.grade === "wrong").length,
  };
}
