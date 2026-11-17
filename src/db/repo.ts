// Operazioni sul database usate dall'app (senza interfaccia).
import { classifyError } from "../lib/errorType.ts";
import { dayKey, newState, schedule, type Rating, type SrsState } from "../lib/srs.ts";
import { computeStreak, nextItem, studyItems, summarize, type StudyItem } from "../lib/study.ts";
import type { AnswerResult } from "../lib/arena.ts";
import { scoreSession } from "../lib/arena.ts";
import type { Card } from "../types/content.ts";
import type { ArenaDB, ErrorRow } from "./db.ts";
import { loadSettings } from "./settings.ts";

export async function loadStates(db: ArenaDB): Promise<Map<string, SrsState>> {
  const rows = await db.srs.toArray();
  return new Map(rows.map(({ key, ...s }) => [key, s]));
}

/** Carte nuove introdotte oggi (risposte con fase precedente "new"). */
export async function newIntroducedToday(db: ArenaDB, now: number): Promise<number> {
  const today = await db.reviews.where("day").equals(dayKey(now)).toArray();
  return new Set(today.filter((r) => r.prevPhase === "new").map((r) => r.key)).size;
}

/** `newCap`: totale di carte nuove permesse oggi quando si continua oltre l'obiettivo (mai sotto il limite). */
export async function studyContext(db: ArenaDB, cards: Card[], now: number, newCap = 0) {
  const [settings, states, introduced] = await Promise.all([loadSettings(db), loadStates(db), newIntroducedToday(db, now)]);
  const items = studyItems(cards, settings.reverse);
  const newLeftToday = Math.max(0, Math.max(settings.newPerDay, newCap) - introduced);
  return { settings, states, items, newLeftToday, introduced };
}

// Nota: niente orderBy / reverse / filter / limit / uniqueKeys di Dexie. Usano i cursori di IndexedDB,
// che su Safari per iPhone falliscono con «UnknownError: Unable to open cursor».
// Si legge tutto con toArray() (getAll, senza cursore) e si ordina qui: i dati sono pochi.

/** Giorni in cui hai risposto ad almeno una carta (più quelli importati dalla vecchia Olaszóra). */
export async function studiedDays(db: ArenaDB): Promise<Set<string>> {
  const days = new Set((await db.reviews.toArray()).map((r) => r.day));
  const legacy = (await db.settings.get("legacyDays"))?.value;
  if (Array.isArray(legacy)) for (const d of legacy) if (typeof d === "string") days.add(d);
  return days;
}

/** Lezioni segnate come fatte ("L03"…). */
export async function lessonsDone(db: ArenaDB): Promise<string[]> {
  const v = (await db.settings.get("lessonsDone"))?.value;
  return Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : [];
}

/** Segna (o toglie) una lezione come fatta. */
export async function setLessonDone(db: ArenaDB, id: string, done: boolean): Promise<void> {
  await db.transaction("rw", db.settings, async () => {
    const list = new Set(await lessonsDone(db));
    if (done) list.add(id);
    else list.delete(id);
    await db.settings.put({ key: "lessonsDone", value: [...list].sort() });
  });
}

/** Errori dal più recente; `limit` facoltativo; `withOverride` include quelli ribaltati con «Era giusta». */
export async function recentErrors(db: ArenaDB, limit?: number, withOverride = true): Promise<ErrorRow[]> {
  const rows = (await db.errors.toArray()).filter((e) => withOverride || !e.override).sort((a, b) => b.date - a.date);
  return limit === undefined ? rows : rows.slice(0, limit);
}

/** Sessioni Arena dalla più recente. */
export async function recentSessions(db: ArenaDB, limit?: number) {
  const rows = (await db.sessions.toArray()).sort((a, b) => b.date - a.date);
  return limit === undefined ? rows : rows.slice(0, limit);
}

/** Dati della Home: carte da ripassare oggi, nuove rimaste, streak. */
export async function homeSummary(db: ArenaDB, cards: Card[], now: number) {
  const { states, items, newLeftToday } = await studyContext(db, cards, now);
  const days = await studiedDays(db);
  (await db.sessions.toArray()).forEach((s) => days.add(dayKey(s.date)));
  return { ...summarize(items, states, now, newLeftToday), streak: computeStreak(days, now) };
}

export async function nextCard(db: ArenaDB, cards: Card[], now: number): Promise<StudyItem | null> {
  const { states, items, newLeftToday } = await studyContext(db, cards, now);
  return nextItem(items, states, now, newLeftToday);
}

/** Registra una risposta a una flashcard e salva il nuovo stato. */
export async function answerCard(db: ArenaDB, key: string, rating: Rating, now: number): Promise<SrsState> {
  return db.transaction("rw", db.srs, db.reviews, async () => {
    const row = await db.srs.get(key);
    const prev: SrsState = row ? (({ key: _k, ...s }) => s)(row) : newState();
    const next = schedule(prev, rating, now);
    await db.srs.put({ key, ...next });
    await db.reviews.add({ key, time: now, day: dayKey(now), rating, prevPhase: prev.phase });
    return next;
  });
}

/** Salva una sessione Arena e gli errori (anche quelli ribaltati, marcati override). */
export async function saveArenaSession(db: ArenaDB, topics: string[], results: AnswerResult[], now: number): Promise<number> {
  const score = scoreSession(results);
  return db.transaction("rw", db.sessions, db.errors, async () => {
    const errors: ErrorRow[] = [];
    for (const r of results) {
      const original = r.override ? r.originalGrade : r.grade;
      if (!original || original === "correct") continue;
      errors.push({
        date: now,
        topic: r.topic,
        exerciseId: r.exerciseId,
        given: r.given,
        expected: r.expected,
        grade: original,
        type: classifyError(r.given, r.expected, original) ?? "lessico",
        ...(r.override ? { override: true } : {}),
      });
    }
    if (errors.length) await db.errors.bulkAdd(errors);
    return (await db.sessions.add({
      date: now,
      topics,
      points: score.points,
      max: score.max,
      results: results.map((r) => ({ exerciseId: r.exerciseId, given: r.given, grade: r.grade, ...(r.override ? { override: true } : {}) })),
    })) as number;
  });
}

/** Miglior punteggio locale per argomento, su 10 (solo sessioni di un argomento). */
export async function bestLocalScores(db: ArenaDB): Promise<Map<string, number>> {
  const best = new Map<string, number>();
  for (const s of await db.sessions.toArray()) {
    if (s.topics.length !== 1 || !s.max) continue;
    const t = s.topics[0]!;
    const v = Math.round((s.points / s.max) * 100) / 10;
    if (v > (best.get(t) ?? -1)) best.set(t, v);
  }
  return best;
}

/** Carte a cui hai risposto oggi (chiavi distinte). */
export async function doneToday(db: ArenaDB, now: number): Promise<number> {
  const today = await db.reviews.where("day").equals(dayKey(now)).toArray();
  return new Set(today.map((r) => r.key)).size;
}
