import "fake-indexeddb/auto";
import { describe, expect, it } from "vitest";
import { ArenaDB } from "../src/db/db.ts";
import { convertLegacy, importLegacy, legacyDayToTime, readHashLegacy, readLocalLegacy } from "../src/db/migrate.ts";
import { lessonsDone, studiedDays } from "../src/db/repo.ts";

const NOW = new Date(2026, 10, 17, 10, 0).getTime();
const day = (y: number, m: number, d: number) => Math.floor(Date.UTC(y, m - 1, d) / 864e5);
const ids = { "1:pronto": "L01-001", "1:ciao": "L01-003", "2:grande": "L02-003" };

describe("convertLegacy", () => {
  it("traduce le scatole Leitner in SM-2", () => {
    const r = convertLegacy({ boxes: { "1:pronto": 2, "1:ciao": 0, "9:sconosciuta": 1 }, due: { "1:pronto": day(2026, 11, 20) } }, NOW, ids);
    const pronto = r.srs.find((s) => s.key === "L01-001")!;
    expect(pronto).toMatchObject({ phase: "review", interval: 3, ease: 2.5, reps: 2 });
    expect(pronto.due).toBe(new Date(2026, 10, 20).getTime());
    expect(r.srs.find((s) => s.key === "L01-003")).toMatchObject({ phase: "learning", due: NOW });
    expect(r.srs).toHaveLength(2);
  });
  it("lezioni fatte, giorni di studio e tema", () => {
    const r = convertLegacy({ done: [3, 1, 1], days: ["2026-11-01", "x"], theme: "dark" }, NOW, ids);
    expect(r.lessonsDone).toEqual(["L01", "L03"]);
    expect(r.days).toEqual(["2026-11-01"]);
    expect(r.theme).toBe("dark");
    expect(convertLegacy({ theme: "" }, NOW, ids).theme).toBe("auto");
  });
  it("legacyDayToTime: mezzanotte locale", () => {
    expect(legacyDayToTime(day(2026, 3, 29))).toBe(new Date(2026, 2, 29).getTime());
  });
});

describe("lettura dei vecchi dati", () => {
  it("dal localStorage", () => {
    const store = new Map([["olaszora:done", "[1,2]"], ["olaszora:theme", '"light"'], ["olaszora:boxes", "{bad"]]);
    expect(readLocalLegacy({ getItem: (k) => store.get(k) ?? null })).toEqual({ done: [1, 2], theme: "light", boxes: undefined, due: undefined, days: undefined });
    expect(readLocalLegacy({ getItem: () => null })).toBeNull();
  });
  it("dall'indirizzo #/atvetel/…", () => {
    const json = JSON.stringify({ done: [1], theme: "" });
    const b64 = Buffer.from(json, "utf8").toString("base64").replace(/\+/g, "-").replace(/\//g, "_");
    expect(readHashLegacy(`#/atvetel/${b64}`)).toEqual({ done: [1], theme: "" });
    expect(readHashLegacy("#/leckek")).toBeNull();
    expect(readHashLegacy("#/atvetel/!!!")).toBeNull();
  });
});

describe("importLegacy", () => {
  it("scrive una volta sola e non tocca le carte già studiate", async () => {
    const db = new ArenaDB(`mig-${Math.random()}`);
    await db.srs.put({ key: "L01-001", phase: "review", step: 0, due: 1, interval: 9, ease: 2.7, reps: 5, lapses: 0 });
    const first = await importLegacy(db, { boxes: { "1:pronto": 1, "1:ciao": 3 }, done: [1], days: ["2026-11-01"] }, NOW);
    expect(first).toEqual({ cards: 1, lessons: 1, days: 1 });
    expect((await db.srs.get("L01-001"))!.interval).toBe(9);
    expect((await db.srs.get("L01-003"))!.interval).toBe(7);
    expect(await lessonsDone(db)).toEqual(["L01"]);
    expect((await studiedDays(db)).has("2026-11-01")).toBe(true);
    expect(await importLegacy(db, { done: [2] }, NOW)).toBeNull();
    expect(await lessonsDone(db)).toEqual(["L01"]);
    expect((await db.settings.get("legacyNotice"))?.value).toEqual({ cards: 1, lessons: 1, days: 1 });
  });
});
