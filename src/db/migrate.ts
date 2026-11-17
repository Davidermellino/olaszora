// Importa una volta sola i progressi della vecchia Olaszóra (index.html con localStorage, chiavi "olaszora:*").
// Il vecchio localStorage non viene mai cancellato.
//
// Due strade, perché il localStorage è legato all'indirizzo del sito:
// - stesso indirizzo: si leggono direttamente le chiavi "olaszora:*";
// - dal vecchio sito (Vercel): il pulsante «Átköltözés» apre la nuova app con i dati dopo il #
//   (#/atvetel/<base64url>), che non arriva a nessun server.
import legacyIds from "../../content/legacy-ids.json";
import { addDays, DEFAULT_CONFIG, startOfDay, type SrsState } from "../lib/srs.ts";
import type { ArenaDB, SrsRow } from "./db.ts";

/** I dati della vecchia app, come stavano nel localStorage (senza il prefisso "olaszora:"). */
export interface LegacyData {
  /** Numeri delle lezioni fatte. */
  done?: unknown;
  /** Scatola Leitner per carta (0–3), chiave "3:la famiglia". */
  boxes?: unknown;
  /** Giorno di scadenza per carta: giorni dal 1/1/1970 (data locale). */
  due?: unknown;
  /** Giorni di studio "YYYY-MM-DD". */
  days?: unknown;
  /** "" (automatico), "light", "dark". */
  theme?: unknown;
}

export interface LegacyResult {
  srs: SrsRow[];
  lessonsDone: string[];
  days: string[];
  theme: "auto" | "light" | "dark" | null;
}

/** Intervalli in giorni delle scatole 0–3 della vecchia app. */
const GAP = [0, 1, 3, 7];
const ID_MAP = legacyIds as Record<string, string>;

const isObj = (v: unknown): v is Record<string, unknown> => !!v && typeof v === "object" && !Array.isArray(v);

/** Mezzanotte locale del giorno `k` (giorni dal 1/1/1970, come `dayNum()` della vecchia app). */
export function legacyDayToTime(k: number): number {
  const d = new Date(k * 86_400_000);
  return new Date(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()).getTime();
}

/**
 * Traduce i vecchi dati nel formato nuovo (logica pura).
 * - scatola ≥ 1 → carta in ripasso, intervallo 1/3/7 giorni, scadenza uguale alla vecchia;
 * - scatola 0 (vista ma sbagliata) → in apprendimento, da rifare subito;
 * - carte mai viste: nessuna riga (restano nuove).
 */
export function convertLegacy(old: LegacyData, now: number, ids: Record<string, string> = ID_MAP): LegacyResult {
  const srs: SrsRow[] = [];
  const boxes = isObj(old.boxes) ? old.boxes : {};
  const due = isObj(old.due) ? old.due : {};
  for (const [oldId, raw] of Object.entries(boxes)) {
    const key = ids[oldId];
    const box = Number(raw);
    if (!key || !Number.isInteger(box) || box < 0 || box > 3) continue;
    const base: SrsState = { phase: "new", step: 0, due: 0, interval: 0, ease: DEFAULT_CONFIG.startingEase, reps: box, lapses: 0 };
    if (box === 0) {
      srs.push({ key, ...base, phase: "learning", due: now });
    } else {
      const d = Number(due[oldId]);
      const when = Number.isFinite(d) ? legacyDayToTime(d) : addDays(now, GAP[box]!);
      srs.push({ key, ...base, phase: "review", interval: GAP[box]!, due: when, lastReview: addDays(startOfDay(when), -GAP[box]!) });
    }
  }
  const lessonsDone = (Array.isArray(old.done) ? old.done : [])
    .map(Number)
    .filter((n) => Number.isInteger(n) && n > 0)
    .map((n) => `L${String(n).padStart(2, "0")}`);
  const days = (Array.isArray(old.days) ? old.days : []).filter((d): d is string => typeof d === "string" && /^\d{4}-\d{2}-\d{2}$/.test(d));
  const theme = old.theme === "light" || old.theme === "dark" ? old.theme : old.theme === "" ? "auto" : null;
  return { srs, lessonsDone: [...new Set(lessonsDone)].sort(), days: [...new Set(days)].sort(), theme };
}

/** Legge le chiavi "olaszora:*" di questo indirizzo. null se non ci sono. */
export function readLocalLegacy(storage: Pick<Storage, "getItem"> | undefined = globalThis.localStorage): LegacyData | null {
  if (!storage) return null;
  const get = (k: string) => {
    try {
      const v = storage.getItem(`olaszora:${k}`);
      return v === null ? undefined : (JSON.parse(v) as unknown);
    } catch {
      return undefined;
    }
  };
  const data: LegacyData = { done: get("done"), boxes: get("boxes"), due: get("due"), days: get("days"), theme: get("theme") };
  return Object.values(data).some((v) => v !== undefined) ? data : null;
}

/** "#/atvetel/<base64url>" → dati. null se l'indirizzo non li contiene o non sono leggibili. */
export function readHashLegacy(hash: string): LegacyData | null {
  const m = /^#\/atvetel\/([A-Za-z0-9_-]+=*)$/.exec(hash);
  if (!m) return null;
  try {
    const b64 = m[1]!.replace(/-/g, "+").replace(/_/g, "/");
    const bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
    const data = JSON.parse(new TextDecoder().decode(bytes)) as unknown;
    return isObj(data) ? (data as LegacyData) : null;
  } catch {
    return null;
  }
}

export interface ImportSummary {
  cards: number;
  lessons: number;
  days: number;
}

/**
 * Scrive i vecchi progressi nel database, una volta sola (flag "legacyImported").
 * Non sovrascrive le carte che hanno già una storia nella nuova app.
 */
export async function importLegacy(db: ArenaDB, old: LegacyData, now = Date.now()): Promise<ImportSummary | null> {
  const r = convertLegacy(old, now);
  return db.transaction("rw", db.srs, db.settings, async () => {
    if ((await db.settings.get("legacyImported"))?.value) return null;
    const existing = new Set((await db.srs.toArray()).map((x) => x.key));
    const rows = r.srs.filter((x) => !existing.has(x.key));
    if (rows.length) await db.srs.bulkPut(rows);
    const doneRow = (await db.settings.get("lessonsDone"))?.value;
    const done = new Set([...(Array.isArray(doneRow) ? (doneRow as string[]) : []), ...r.lessonsDone]);
    await db.settings.put({ key: "lessonsDone", value: [...done].sort() });
    await db.settings.put({ key: "legacyDays", value: r.days });
    if (r.theme && !(await db.settings.get("theme"))) await db.settings.put({ key: "theme", value: r.theme });
    const summary: ImportSummary = { cards: rows.length, lessons: r.lessonsDone.length, days: r.days.length };
    await db.settings.put({ key: "legacyImported", value: { at: now, ...summary } });
    // Il messaggio in Oggi si mostra una volta sola: si toglie con «Rendben».
    await db.settings.put({ key: "legacyNotice", value: summary });
    return summary;
  });
}

/** All'avvio: dati dall'indirizzo (#/atvetel/…) o dal localStorage di questo sito. */
export async function migrateOnStart(db: ArenaDB): Promise<void> {
  const fromHash = readHashLegacy(location.hash);
  if (fromHash) history.replaceState(null, "", location.pathname + location.search + "#/");
  const old = fromHash ?? readLocalLegacy();
  if (old) await importLegacy(db, old);
}
