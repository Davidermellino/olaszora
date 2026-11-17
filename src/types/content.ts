// Formati dei file in content/. Documentati anche nel README:
// se cambi qualcosa qui, aggiorna il README e scripts/validate-content.ts.

/** Una flashcard (content/vocab/*.json). Fronte ungherese, retro italiano. */
export interface Card {
  /** Stabile per sempre: è la chiave dei progressi SRS. */
  id: string;
  it: string;
  hu: string;
  exampleHu?: string;
  exampleIt?: string;
  /** Mazzo: "szavak" (parole delle lezioni) o "errori-arena". */
  tag: string;
  /** Lezione, es. "L07". */
  lesson?: string;
  /** Nota breve mostrata sul retro. */
  note?: string;
}

/** File content/vocab/parole.json, generato dalle tabelle «Szavak» delle lezioni. */
export interface VocabFile {
  /** File di origine, es. "content/lessons/L01.md, …". */
  source: string;
  cards: Card[];
}

export type ExerciseType = "mc" | "fill" | "transform" | "translate";

export interface Exercise {
  /** "A01-001": prefisso = id dell'argomento. Mai riusare un id. */
  id: string;
  type: ExerciseType;
  /** Consegna. Nei "fill" il buco è scritto ___ */
  prompt: string;
  /** Solo per "mc": le opzioni mostrate. */
  options?: string[];
  /** Tutte le forme accettate (varianti d'ordine, con o senza pronome…). */
  answers: string[];
  /** Traduzione ungherese della frase, mostrata dopo la correzione. */
  hu?: string;
  /** Regola con nome, es. "A03: articolo determinativo davanti a vocale → l'". */
  rule: string;
  explanation: string;
}

/** File content/arena/Axx.json */
export interface ArenaTopic {
  id: string;
  title: string;
  /** Regola generale dell'argomento (una o due frasi). */
  rule: string;
  exercises: Exercise[];
}
