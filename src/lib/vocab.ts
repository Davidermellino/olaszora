import type { Lesson } from "./lessons.ts";
import type { Card } from "../types/content.ts";

/** Mazzo unico delle parole delle lezioni. */
export const WORDS_DECK = "szavak";

const ID = /^L\d{2}-\d{3}$/;

/**
 * Carte dalle tabelle «Szavak» delle lezioni: fronte ungherese, retro italiano.
 * L'id ("L03-001") è scritto nel file e non cambia mai.
 */
export function lessonCards(lessons: Lesson[]): { cards: Card[]; warnings: string[] } {
  const cards: Card[] = [];
  const warnings: string[] = [];
  for (const l of lessons) {
    for (const w of l.words) {
      if (!ID.test(w.id)) warnings.push(`${l.id}: id non valido «${w.id}» (atteso es. ${l.id}-001)`);
      else if (!w.id.startsWith(l.id)) warnings.push(`${l.id}: l'id ${w.id} non è di questa lezione`);
      if (!w.it || !w.hu) warnings.push(`${l.id}: ${w.id} senza Olasz o Magyar`);
      cards.push({ id: w.id, it: w.it, hu: w.hu, tag: WORDS_DECK, lesson: l.id });
    }
  }
  return { cards, warnings };
}

/** Id ripetuti tra tutte le carte (devono essere unici). */
export function duplicateIds(cards: Card[]): string[] {
  const seen = new Set<string>();
  const dup = new Set<string>();
  for (const c of cards) (seen.has(c.id) ? dup : seen).add(c.id);
  return [...dup];
}
