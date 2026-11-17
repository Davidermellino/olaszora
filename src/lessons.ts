// Lezioni (content/lessons/Lxx.md), incluse nel bundle come testo.
// Aggiungere un file Lxx.md basta: nessuna modifica qui.
import { parseLesson, plain, type Lesson, type Pair } from "./lib/lessons.ts";
import { normalize } from "./lib/checker.ts";

const files = import.meta.glob<string>("../content/lessons/L*.md", { eager: true, query: "?raw", import: "default" });

export const lessons: Lesson[] = Object.keys(files)
  .map((k) => parseLesson(files[k]!, k))
  .sort((a, b) => a.n - b.n);
export const lessonById = new Map(lessons.map((l) => [l.id, l]));

/** Le battute lette ad alta voce: il dialogo, o nei ripassi l'esercizio di ripasso. */
export function spokenLines(l: Lesson): Pair[] {
  return l.lines.length ? l.lines : (l.exercises.find((e) => e.review)?.items ?? []);
}

// Battute con l'mp3 (vite.config.ts → __AUDIO__): { "L01": [1, 2, …] }
const audio = __AUDIO__ as Record<string, number[]>;
const pad = (n: number) => String(n).padStart(2, "0");

/** Indirizzo dell'mp3 di una battuta, se c'è. */
export function lineAudio(l: Lesson, n: number): string | null {
  return audio[l.id]?.includes(n) ? `${import.meta.env.BASE_URL}audio/${l.id}/${pad(n)}.mp3` : null;
}
export function hasAudio(l: Lesson): boolean {
  return (audio[l.id]?.length ?? 0) > 0;
}

// Frase italiana (normalizzata) → mp3, per mostrare ▶ nell'Arena e nelle flashcard.
const bySentence = new Map<string, string>();
for (const l of lessons) {
  for (const p of spokenLines(l)) {
    const url = lineAudio(l, p.n);
    const key = normalize(plain(p.it));
    if (url && key && !bySentence.has(key)) bySentence.set(key, url);
  }
}
/** L'mp3 di una battuta uguale a questa frase, se c'è. */
export function sentenceAudio(text: string | undefined): string | null {
  return text ? (bySentence.get(normalize(plain(text))) ?? null) : null;
}

export type LessonTab = "dialogusok" | "gyakorlatok" | "nyelvtan";
export const TABS: { id: LessonTab; label: string }[] = [
  { id: "dialogusok", label: "Dialógusok" },
  { id: "gyakorlatok", label: "Gyakorlatok" },
  { id: "nyelvtan", label: "Nyelvtan" },
];
export function asTab(s: string | undefined): LessonTab {
  return s === "gyakorlatok" || s === "nyelvtan" ? s : "dialogusok";
}

/** Le lezioni di ogni sezione: i ripassi non hanno dialogo, non tutte hanno esercizi o note. */
export function lessonsFor(tab: LessonTab): Lesson[] {
  if (tab === "gyakorlatok") return lessons.filter((l) => l.exercises.length > 0);
  if (tab === "nyelvtan") return lessons.filter((l) => l.grammar.length > 0 || l.notes.length > 0);
  return lessons.filter((l) => !l.review);
}
export function hasTab(l: Lesson, tab: LessonTab): boolean {
  return lessonsFor(tab).includes(l);
}
