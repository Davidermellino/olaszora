import "fake-indexeddb/auto";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { ArenaDB } from "../src/db/db.ts";
import { BackupError, exportAll, importAll, parseBackup } from "../src/db/backup.ts";
import { answerCard, bestLocalScores, homeSummary, nextCard, recentErrors, recentSessions, saveArenaSession, studiedDays } from "../src/db/repo.ts";
import { loadSettings, saveSetting } from "../src/db/settings.ts";
import { applyOverride, type AnswerResult } from "../src/lib/arena.ts";
import type { Card } from "../src/types/content.ts";

const NOW = new Date(2026, 10, 7, 9, 0).getTime();
const cards: Card[] = Array.from({ length: 12 }, (_, i) => ({ id: `c${i}`, it: `it${i}`, hu: `hu${i}`, tag: "t" }));
let db: ArenaDB;
let n = 0;

beforeEach(() => {
  db = new ArenaDB(`test-${n++}`);
});
afterEach(async () => {
  await db.delete();
});

describe("impostazioni", () => {
  it("default e limiti", async () => {
    expect(await loadSettings(db)).toEqual({ newPerDay: 7, reverse: false, theme: "auto" });
    await saveSetting(db, "newPerDay", 20);
    expect((await loadSettings(db)).newPerDay).toBe(9);
  });
});

describe("flashcard", () => {
  it("al massimo 7 nuove al giorno", async () => {
    let t = NOW;
    let shown = 0;
    for (;;) {
      const item = await nextCard(db, cards, t);
      if (!item) break;
      await answerCard(db, item.key, 4, t); // Facile → in ripasso tra 4 giorni
      shown++;
      t += 1000;
    }
    expect(shown).toBe(7);
    expect(await homeSummary(db, cards, t)).toEqual({ dueToday: 0, newLeft: 0, streak: 1 });
    // Il giorno dopo ci sono altre 5 nuove (12 − 7).
    expect((await homeSummary(db, cards, NOW + 86400000)).newLeft).toBe(5);
  });
});

describe("arena", () => {
  const res = (id: string, grade: AnswerResult["grade"], given = "x"): AnswerResult => ({
    exerciseId: id, topic: "A16", given, expected: "várjátok", grade,
  });
  it("salva sessione ed errori, override marcato", async () => {
    await saveArenaSession(db, ["A16"], [res("A16-001", "correct"), res("A16-002", "wrong", "váritek"), applyOverride(res("A16-003", "minor"))], NOW);
    const errors = await db.errors.toArray();
    expect(errors).toHaveLength(2);
    expect(errors[0]).toMatchObject({ exerciseId: "A16-002", grade: "wrong", type: "desinenza" });
    expect(errors[1]).toMatchObject({ exerciseId: "A16-003", grade: "minor", override: true });
    expect((await bestLocalScores(db)).get("A16")).toBe(6.7); // 4/6 punti (override = ✅)
  });
});

describe("backup", () => {
  it("export → import ripristina tutto", async () => {
    await answerCard(db, "c1", 3, NOW);
    await saveSetting(db, "reverse", true);
    await saveArenaSession(db, ["A17"], [res2()], NOW);
    const json = JSON.stringify(await exportAll(db, NOW));

    const other = new ArenaDB(`other-${n++}`);
    await other.srs.put({ key: "vecchia", phase: "new", step: 0, due: 0, interval: 0, ease: 2.5, reps: 0, lapses: 0 });
    const counts = await importAll(other, parseBackup(json));
    expect(counts).toMatchObject({ srs: 1, reviews: 1, errors: 1, sessions: 1, settings: 1 });
    expect(await other.srs.get("vecchia")).toBeUndefined();
    expect((await loadSettings(other)).reverse).toBe(true);
    await other.delete();
  });
  it("rifiuta file non validi", () => {
    expect(() => parseBackup("non json")).toThrow(BackupError);
    expect(() => parseBackup('{"app":"altro"}')).toThrow(BackupError);
    expect(() => parseBackup('{"app":"olaszora","version":99,"tables":{}}')).toThrow(/verzió/);
    expect(() => parseBackup('{"app":"olaszora","version":1,"tables":{"srs":3}}')).toThrow(/srs/);
  });
});

function res2(): AnswerResult {
  return { exerciseId: "A17-001", topic: "A17", given: "Olvasom egy könyvet", expected: "Olvasok egy könyvet.", grade: "wrong" };
}

describe("letture senza cursore (Safari iPhone)", () => {
  it("errori e sessioni dal più recente, giorni studiati", async () => {
    const base = { topic: "A16", exerciseId: "A16-001", given: "x", expected: "y", grade: "wrong" as const, type: "lessico" as const };
    await db.errors.bulkAdd([{ ...base, date: 1 }, { ...base, date: 3, override: true }, { ...base, date: 2 }]);
    expect((await recentErrors(db)).map((e) => e.date)).toEqual([3, 2, 1]);
    expect((await recentErrors(db, 1, false)).map((e) => e.date)).toEqual([2]);
    await db.sessions.bulkAdd([1, 5, 3].map((date) => ({ date, topics: ["A16"], points: 1, max: 2, results: [] })));
    expect((await recentSessions(db, 2)).map((s) => s.date)).toEqual([5, 3]);
    await db.reviews.bulkAdd([{ key: "a", time: 1, day: "2026-11-08", rating: 3, prevPhase: "new" }, { key: "b", time: 2, day: "2026-11-08", rating: 3, prevPhase: "new" }]);
    expect([...(await studiedDays(db))]).toEqual(["2026-11-08"]);
  });
});
