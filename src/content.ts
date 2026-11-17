// Contenuti statici (content/), inclusi nel bundle da Vite. Aggiungere un file basta: nessuna modifica qui.
import type { ArenaTopic, Card, VocabFile } from "./types/content.ts";

const vocabFiles = import.meta.glob<VocabFile>("../content/vocab/*.json", { eager: true, import: "default" });
const arenaFiles = import.meta.glob<ArenaTopic>("../content/arena/*.json", { eager: true, import: "default" });

export const cards: Card[] = Object.keys(vocabFiles)
  .sort()
  .flatMap((k) => vocabFiles[k]!.cards);

export const arenaTopics: ArenaTopic[] = Object.values(arenaFiles).sort((a, b) => a.id.localeCompare(b.id));
export const arenaById = new Map(arenaTopics.map((t) => [t.id, t]));
export const exerciseById = new Map(arenaTopics.flatMap((t) => t.exercises.map((e) => [e.id, e] as const)));

/** Nomi leggibili dei mazzi. */
export const DECK_NAMES: Record<string, string> = {
  szavak: "A leckék szavai",
  "errori-arena": "Az Aréna hibái",
};
export function deckName(tag: string): string {
  return DECK_NAMES[tag] ?? tag;
}

/**
 * Stato di un argomento, dai punteggi giocati in questo dispositivo
 * (qui non c'è il file dei progressi del tutor):
 * "conquistato" = almeno una sessione con 8/10 o più, "in coda" = giocato ma sotto 8, "nuovo" = mai giocato.
 */
export type TopicStatus = "conquistato" | "in coda" | "nuovo";
export interface TopicRow {
  id: string;
  title: string;
  status: TopicStatus;
  best: number | null;
  exercises: number;
}
export function topicRows(localBest: Map<string, number>): TopicRow[] {
  return arenaTopics.map((t) => {
    const best = localBest.get(t.id) ?? null;
    return {
      id: t.id,
      title: t.title,
      status: best === null ? "nuovo" : best >= 8 ? "conquistato" : "in coda",
      best,
      exercises: t.exercises.length,
    };
  });
}
