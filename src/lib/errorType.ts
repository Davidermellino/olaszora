import { normalize, stripAccents, type Grade } from "./checker.ts";

export type ErrorType = "accento" | "desinenza" | "ordine" | "lessico";

/**
 * Stima il tipo di errore (si può correggere a mano nell'app).
 * - accento:   voto 🟡
 * - ordine:    stesse parole, ordine diverso
 * - desinenza: stesso numero di parole, e ogni parola diversa ha la stessa radice
 *              (prime 3 lettere uguali, senza accenti)
 * - lessico:   tutto il resto
 */
export function classifyError(given: string, expected: string, grade: Grade): ErrorType | null {
  if (grade === "correct") return null;
  if (grade === "minor") return "accento";

  const g = stripAccents(normalize(given)).split(" ").filter(Boolean);
  const e = stripAccents(normalize(expected)).split(" ").filter(Boolean);

  if (g.length === e.length && g.length > 1 && [...g].sort().join(" ") === [...e].sort().join(" ")) return "ordine";

  if (g.length === e.length && g.length > 0) {
    const diff = g.map((w, i) => [w, e[i]!] as const).filter(([a, b]) => a !== b);
    if (diff.length > 0 && diff.every(([a, b]) => sameStem(a, b))) return "desinenza";
  }
  return "lessico";
}

function sameStem(a: string, b: string): boolean {
  const n = Math.min(3, a.length, b.length);
  return n >= 2 && a.slice(0, n) === b.slice(0, n);
}
