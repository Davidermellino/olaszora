import { describe, expect, it } from "vitest";
import type { Card } from "../src/types/content.ts";
import { addDays, dayKey, newState, schedule, type SrsState } from "../src/lib/srs.ts";
import { clampNewPerDay, computeStreak, nextItem, reverseKey, studyItems, summarize } from "../src/lib/study.ts";

const NOW = new Date(2026, 10, 7, 9, 0).getTime();
const card = (id: string): Card => ({ id, it: id, hu: id, tag: "t" });
const cards = ["a", "b", "c", "d"].map(card);

describe("clampNewPerDay", () => {
  it("limita a 5–9, default 7", () => {
    expect(clampNewPerDay(3)).toBe(5);
    expect(clampNewPerDay(12)).toBe(9);
    expect(clampNewPerDay(NaN)).toBe(7);
  });
});

describe("nextItem", () => {
  it("prima i ripassi scaduti, poi le nuove", () => {
    const states = new Map<string, SrsState>([["c", { ...schedule(newState(), 4, NOW - 5 * 86400000), due: NOW - 1 }]]);
    const items = studyItems(cards, false);
    expect(nextItem(items, states, NOW, 7)?.key).toBe("c");
  });
  it("niente nuove se il limite di oggi è finito", () => {
    expect(nextItem(studyItems(cards, false), new Map(), NOW, 0)).toBeNull();
    expect(nextItem(studyItems(cards, false), new Map(), NOW, 1)?.key).toBe("a");
  });
  it("learning scaduto prima dei ripassi", () => {
    const states = new Map<string, SrsState>([
      ["b", { ...newState(), phase: "review", interval: 3, due: NOW - 1000 }],
      ["d", { ...newState(), phase: "learning", due: NOW - 10 }],
    ]);
    expect(nextItem(studyItems(cards, false), states, NOW, 0)?.key).toBe("d");
  });
  it("learn-ahead: mostra un learning che scade a breve se non c'è altro", () => {
    const states = new Map<string, SrsState>([["a", schedule(newState(), 1, NOW)]]);
    expect(nextItem(studyItems([card("a")], false), states, NOW, 0)?.key).toBe("a");
  });
  it("ripassi di domani non compaiono oggi", () => {
    const states = new Map<string, SrsState>([["a", { ...newState(), phase: "review", interval: 1, due: addDays(NOW, 1) }]]);
    expect(nextItem(studyItems([card("a")], false), states, NOW, 0)).toBeNull();
  });
  it("direzione inversa solo dopo che IT→HU è in ripasso", () => {
    const items = studyItems([card("a")], true);
    expect(items.map((i) => i.key)).toEqual(["a", reverseKey("a")]);
    const learning = new Map<string, SrsState>([["a", { ...schedule(newState(), 3, NOW), due: NOW + 3600000 }]]);
    expect(nextItem(items, learning, NOW, 5)).toBeNull();
    const rev = new Map<string, SrsState>([["a", schedule(newState(), 4, NOW)]]);
    expect(nextItem(items, rev, NOW, 5)?.key).toBe("a:r");
  });
});

describe("summarize", () => {
  it("conta scadute oggi e nuove rimaste", () => {
    const states = new Map<string, SrsState>([
      ["a", { ...newState(), phase: "review", interval: 2, due: NOW - 1 }],
      ["b", { ...newState(), phase: "review", interval: 2, due: addDays(NOW, 2) }],
    ]);
    expect(summarize(studyItems(cards, false), states, NOW, 7)).toEqual({ dueToday: 1, newLeft: 2 });
  });
});

describe("computeStreak", () => {
  const d = (n: number) => dayKey(addDays(NOW, n));
  it("conta i giorni consecutivi fino a oggi", () => {
    expect(computeStreak(new Set([d(0), d(-1), d(-2), d(-4)]), NOW)).toBe(3);
  });
  it("se oggi non hai studiato, conta fino a ieri", () => {
    expect(computeStreak(new Set([d(-1), d(-2)]), NOW)).toBe(2);
  });
  it("zero se ieri e oggi sono vuoti", () => {
    expect(computeStreak(new Set([d(-2)]), NOW)).toBe(0);
  });
});

import { extraAvailable, nextAhead } from "../src/lib/study.ts";

describe("oltre l'obiettivo", () => {
  it("nextAhead prende il ripasso futuro più vicino e conta le carte in più", () => {
    const now = new Date(2026, 10, 7, 12).getTime();
    const mk = (id: string) => ({ id, it: id, hu: id, tag: "t" });
    const items = studyItems([mk("a"), mk("b"), mk("c")], false);
    const rev = (due: number) => ({ phase: "review" as const, step: 0, due, interval: 3, ease: 2.5, reps: 3, lapses: 0 });
    const states = new Map([["a", rev(new Date(2026, 10, 10).getTime())], ["b", rev(new Date(2026, 10, 8).getTime())]]);
    expect(nextAhead(items, states, now)?.key).toBe("b");
    expect(extraAvailable(items, states, now)).toEqual({ unseen: 1, ahead: 2 });
  });
});
