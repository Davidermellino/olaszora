// Coda di studio delle flashcard (logica pura, senza database).
import type { Card } from "../types/content.ts";
import { addDays, dayKey, type SrsState } from "./srs.ts";

/** "hu-it": fronte ungherese, retro italiano (la direzione principale). "it-hu": quella inversa, facoltativa. */
export type Direction = "hu-it" | "it-hu";

export interface StudyItem {
  /** Chiave dello stato SRS: id della carta, con ":r" per la direzione IT→HU. */
  key: string;
  card: Card;
  dir: Direction;
}

export const NEW_PER_DAY = { default: 7, min: 5, max: 9 } as const;

export function clampNewPerDay(n: number): number {
  if (!Number.isFinite(n)) return NEW_PER_DAY.default;
  return Math.min(NEW_PER_DAY.max, Math.max(NEW_PER_DAY.min, Math.round(n)));
}

export function reverseKey(cardId: string): string {
  return `${cardId}:r`;
}

/** Elementi studiabili. Con `reverse`, ogni carta ha anche la direzione IT→HU. */
export function studyItems(cards: Card[], reverse: boolean): StudyItem[] {
  const out: StudyItem[] = [];
  for (const card of cards) {
    out.push({ key: card.id, card, dir: "hu-it" });
    if (reverse) out.push({ key: reverseKey(card.id), card, dir: "it-hu" });
  }
  return out;
}

function isNew(item: StudyItem, states: Map<string, SrsState>): boolean {
  const s = states.get(item.key);
  if (s && s.phase !== "new") return false;
  // La direzione IT→HU entra solo dopo che HU→IT è passata in ripasso.
  if (item.dir === "it-hu") return states.get(item.card.id)?.phase === "review";
  return true;
}

export interface QueueSummary {
  /** Learning/relearning e ripassi che scadono entro oggi. */
  dueToday: number;
  /** Carte nuove che si possono ancora introdurre oggi. */
  newLeft: number;
}

export function summarize(items: StudyItem[], states: Map<string, SrsState>, now: number, newLeftToday: number): QueueSummary {
  const endOfToday = addDays(now, 1);
  let dueToday = 0;
  let newAvailable = 0;
  for (const it of items) {
    const s = states.get(it.key);
    if (s && s.phase !== "new") {
      if (s.due < endOfToday) dueToday++;
    } else if (isNew(it, states)) newAvailable++;
  }
  return { dueToday, newLeft: Math.max(0, Math.min(newLeftToday, newAvailable)) };
}

/**
 * Prossima carta da mostrare:
 * 1. learning/relearning già scadute
 * 2. ripassi scaduti entro oggi (prima i più vecchi)
 * 3. nuove (nell'ordine del file), se ne restano per oggi
 * 4. learning che scadono entro `learnAheadMin` minuti (per non chiudere la sessione troppo presto)
 */
export function nextItem(
  items: StudyItem[],
  states: Map<string, SrsState>,
  now: number,
  newLeftToday: number,
  learnAheadMin = 20,
): StudyItem | null {
  const endOfToday = addDays(now, 1);
  let learningDue: [StudyItem, number] | null = null;
  let reviewDue: [StudyItem, number] | null = null;
  let firstNew: StudyItem | null = null;
  let learningAhead: [StudyItem, number] | null = null;

  for (const it of items) {
    const s = states.get(it.key);
    if (!s || s.phase === "new") {
      if (!firstNew && newLeftToday > 0 && isNew(it, states)) firstNew = it;
      continue;
    }
    if (s.phase === "learning" || s.phase === "relearning") {
      if (s.due <= now) {
        if (!learningDue || s.due < learningDue[1]) learningDue = [it, s.due];
      } else if (s.due <= now + learnAheadMin * 60_000) {
        if (!learningAhead || s.due < learningAhead[1]) learningAhead = [it, s.due];
      }
    } else if (s.due < endOfToday) {
      if (!reviewDue || s.due < reviewDue[1]) reviewDue = [it, s.due];
    }
  }
  return learningDue?.[0] ?? reviewDue?.[0] ?? firstNew ?? learningAhead?.[0] ?? null;
}

/** Giorni consecutivi di studio. Se oggi non hai ancora studiato, la serie conta fino a ieri. */
export function computeStreak(studiedDays: Set<string>, now: number): number {
  let t = studiedDays.has(dayKey(now)) ? now : addDays(now, -1);
  let n = 0;
  while (studiedDays.has(dayKey(t))) {
    n++;
    t = addDays(t, -1);
  }
  return n;
}

/**
 * Ripasso in anticipo, dopo l'obiettivo del giorno: la carta in ripasso che scade prima
 * tra quelle in calendario da domani in poi.
 */
export function nextAhead(items: StudyItem[], states: Map<string, SrsState>, now: number): StudyItem | null {
  const endOfToday = addDays(now, 1);
  let best: [StudyItem, number] | null = null;
  for (const it of items) {
    const s = states.get(it.key);
    if (s?.phase !== "review" || s.due < endOfToday) continue;
    if (!best || s.due < best[1]) best = [it, s.due];
  }
  return best?.[0] ?? null;
}

/** Quante carte si possono ancora fare oltre l'obiettivo: nuove non viste e ripassi futuri. */
export function extraAvailable(items: StudyItem[], states: Map<string, SrsState>, now: number): { unseen: number; ahead: number } {
  const endOfToday = addDays(now, 1);
  let unseen = 0;
  let ahead = 0;
  for (const it of items) {
    const s = states.get(it.key);
    if (s?.phase === "review" && s.due >= endOfToday) ahead++;
    else if ((!s || s.phase === "new") && isNew(it, states)) unseen++;
  }
  return { unseen, ahead };
}
