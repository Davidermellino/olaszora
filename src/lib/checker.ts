// Correzione delle risposte, come nella Grammar Arena:
// ✅ correct  = uguale a una risposta accettata dopo la normalizzazione
// 🟡 minor    = uguale solo togliendo gli accenti (à è é ì ò ù → a e e i o u; anche è/é)
// ❌ wrong    = tutto il resto

export type Grade = "correct" | "minor" | "wrong";

export interface CheckResult {
  grade: Grade;
  /** La risposta accettata più vicina, nella forma originale (con maiuscole e punteggiatura). */
  expected: string;
  /** Solo per "minor": la risposta data e quella attesa normalizzate, e le posizioni con l'accento sbagliato. */
  accent?: { given: string; expected: string; positions: number[] };
}

/**
 * Normalizzazione per il confronto:
 * - Unicode NFC, minuscole
 * - virgolette, apostrofi e trattini tipografici uniformati
 * - la punteggiatura (. , ; : ! ? … " ' « » „ “ ” – —) diventa spazio,
 *   tranne il trattino dentro una parola; l'apostrofo diventa spazio: «c'è» = «c è»
 * - spazi multipli ridotti, spazi ai bordi tolti
 *
 * Nota: si ignora tutta la punteggiatura, non solo quella finale. Una virgola
 * mancante non è un errore di grammatica. «perche'» (accento scritto con l'apostrofo) vale 🟡.
 */
export function normalize(s: string): string {
  return s
    .normalize("NFC")
    .toLocaleLowerCase("it")
    .replace(/[‐‑‒–—―]/g, "-")
    .replace(/(^|[^\p{L}\d])-+|-+(?=$|[^\p{L}\d])/gu, "$1 ")
    .replace(/[^\p{L}\d\s-]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Toglie i diacritici: à→a, è→e, é→e… Mantiene la lunghezza in caratteri (stringa già NFC). */
export function stripAccents(s: string): string {
  return [...s].map((ch) => ch.normalize("NFD").replace(/\p{M}/gu, "").normalize("NFC")).join("");
}

/** Posizioni (in caratteri) dove due stringhe della stessa forma senza accenti differiscono. */
export function accentPositions(given: string, expected: string): number[] {
  const a = [...given];
  const b = [...expected];
  const pos: number[] = [];
  for (let i = 0; i < Math.max(a.length, b.length); i++) if (a[i] !== b[i]) pos.push(i);
  return pos;
}

export function levenshtein(a: string, b: string): number {
  const x = [...a];
  const y = [...b];
  let prev = Array.from({ length: y.length + 1 }, (_, j) => j);
  for (let i = 1; i <= x.length; i++) {
    const cur = [i];
    for (let j = 1; j <= y.length; j++) {
      cur[j] = Math.min(prev[j]! + 1, cur[j - 1]! + 1, prev[j - 1]! + (x[i - 1] === y[j - 1] ? 0 : 1));
    }
    prev = cur;
  }
  return prev[y.length]!;
}

export function checkAnswer(given: string, answers: string[]): CheckResult {
  if (answers.length === 0) throw new Error("checkAnswer: nessuna risposta accettata");
  const g = normalize(given);

  for (const a of answers) if (normalize(a) === g) return { grade: "correct", expected: a };

  const gs = stripAccents(g);
  for (const a of answers) {
    const n = normalize(a);
    if (stripAccents(n) === gs) {
      return { grade: "minor", expected: a, accent: { given: g, expected: n, positions: accentPositions(g, n) } };
    }
  }

  let best = answers[0]!;
  let bestD = Infinity;
  for (const a of answers) {
    const d = levenshtein(gs, stripAccents(normalize(a)));
    if (d < bestD) {
      bestD = d;
      best = a;
    }
  }
  return { grade: "wrong", expected: best };
}

/** Punti BOSS: ✅ 2 · 🟡 1 · ❌ 0. */
export function gradePoints(g: Grade): number {
  return g === "correct" ? 2 : g === "minor" ? 1 : 0;
}
