// Database locale (IndexedDB via Dexie). Tutto resta sul telefono.
// Se cambi lo schema: nuova .version(n) con upgrade, e aggiorna BACKUP_VERSION in backup.ts.
import Dexie, { type EntityTable } from "dexie";
import type { Grade } from "../lib/checker.ts";
import type { ErrorType } from "../lib/errorType.ts";
import type { Rating, SrsState } from "../lib/srs.ts";

export interface SrsRow extends SrsState {
  /** Id carta, con ":r" per IT→HU. */
  key: string;
}

export interface ReviewRow {
  id?: number;
  key: string;
  time: number;
  /** "YYYY-MM-DD" locale: serve per streak e nuove carte del giorno. */
  day: string;
  rating: Rating;
  /** Fase prima della risposta ("new" = carta introdotta oggi). */
  prevPhase: SrsState["phase"];
}

export interface ErrorRow {
  id?: number;
  /** ms epoch */
  date: number;
  topic: string;
  exerciseId: string;
  given: string;
  expected: string;
  grade: Exclude<Grade, "correct">;
  type: ErrorType;
  /** "Era giusta": l'errore è stato ribaltato. Escluso dalle statistiche. */
  override?: boolean;
}

export interface SessionRow {
  id?: number;
  date: number;
  /** ["A16"] o più argomenti per il Torneo. */
  topics: string[];
  points: number;
  max: number;
  results: { exerciseId: string; given: string; grade: Grade; override?: boolean }[];
}

export interface SettingRow {
  key: string;
  value: unknown;
}

export class ArenaDB extends Dexie {
  srs!: EntityTable<SrsRow, "key">;
  reviews!: EntityTable<ReviewRow, "id">;
  errors!: EntityTable<ErrorRow, "id">;
  sessions!: EntityTable<SessionRow, "id">;
  settings!: EntityTable<SettingRow, "key">;

  constructor(name = "olaszora") {
    super(name);
    this.version(1).stores({
      srs: "key, due, phase",
      reviews: "++id, day, key",
      errors: "++id, date, topic, exerciseId",
      sessions: "++id, date",
      settings: "key",
    });
  }
}

export const TABLES = ["srs", "reviews", "errors", "sessions", "settings"] as const;
export type TableName = (typeof TABLES)[number];
