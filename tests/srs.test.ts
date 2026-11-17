import { describe, expect, it } from "vitest";
import { addDays, dayKey, newState, previewIntervals, schedule, type SrsState } from "../src/lib/srs.ts";

const NOW = new Date(2026, 10, 7, 9, 0).getTime(); // 7 nov 2026, 9:00 locale
const MIN = 60_000;

describe("carte nuove e apprendimento", () => {
  it("Ancora → 1 minuto, step 0", () => {
    const s = schedule(newState(), 1, NOW);
    expect(s.phase).toBe("learning");
    expect(s.step).toBe(0);
    expect(s.due).toBe(NOW + 1 * MIN);
  });
  it("Difficile sul primo step → media 1m/10m", () => {
    const s = schedule(newState(), 2, NOW);
    expect(s.due).toBe(NOW + 5.5 * MIN);
  });
  it("Bene → step 1 (10 minuti), poi Bene → ripasso domani", () => {
    const a = schedule(newState(), 3, NOW);
    expect(a.phase).toBe("learning");
    expect(a.due).toBe(NOW + 10 * MIN);
    const b = schedule(a, 3, NOW + 10 * MIN);
    expect(b.phase).toBe("review");
    expect(b.interval).toBe(1);
    expect(b.due).toBe(addDays(NOW, 1));
  });
  it("Facile → ripasso tra 4 giorni", () => {
    const s = schedule(newState(), 4, NOW);
    expect(s.phase).toBe("review");
    expect(s.interval).toBe(4);
    expect(dayKey(s.due)).toBe("2026-11-11");
  });
  it("Ancora in learning torna allo step 0", () => {
    const a = schedule(newState(), 3, NOW);
    const b = schedule(a, 1, NOW + 10 * MIN);
    expect(b.step).toBe(0);
    expect(b.due).toBe(NOW + 11 * MIN);
  });
  it("non modifica lo stato di partenza", () => {
    const s0 = newState();
    schedule(s0, 4, NOW);
    expect(s0.phase).toBe("new");
  });
});

const review = (interval: number, ease = 2.5): SrsState => ({
  phase: "review", step: 0, due: NOW, interval, ease, reps: 5, lapses: 0,
});

describe("ripasso (SM-2)", () => {
  it("Bene: intervallo × ease", () => {
    const s = schedule(review(10), 3, NOW);
    expect(s.interval).toBe(25);
    expect(s.ease).toBe(2.5);
  });
  it("Difficile: × 1,2 e ease −0,15", () => {
    const s = schedule(review(10), 2, NOW);
    expect(s.interval).toBe(12);
    expect(s.ease).toBeCloseTo(2.35);
  });
  it("Facile: × ease × 1,3 e ease +0,15", () => {
    const s = schedule(review(10), 4, NOW);
    expect(s.interval).toBe(33); // 10 × 2,5 × 1,3 = 32,5
    expect(s.ease).toBeCloseTo(2.65);
  });
  it("l'intervallo cresce almeno di 1 giorno", () => {
    expect(schedule(review(1, 1.3), 2, NOW).interval).toBe(2);
    expect(schedule(review(1, 1.3), 3, NOW).interval).toBe(2);
  });
  it("Ancora: lapse, relearning 10m, ease −0,2", () => {
    const s = schedule(review(10), 1, NOW);
    expect(s.phase).toBe("relearning");
    expect(s.lapses).toBe(1);
    expect(s.ease).toBeCloseTo(2.3);
    expect(s.due).toBe(NOW + 10 * MIN);
    const back = schedule(s, 3, NOW + 10 * MIN);
    expect(back.phase).toBe("review");
    expect(back.interval).toBe(1);
  });
  it("ease minima 1,3", () => {
    expect(schedule(review(5, 1.35), 1, NOW).ease).toBe(1.3);
  });
  it("scadenza a mezzanotte locale", () => {
    const s = schedule(review(3), 3, NOW + 15 * 60 * MIN); // 24:00 circa
    expect(new Date(s.due).getHours()).toBe(0);
  });
});

describe("addDays e ora legale", () => {
  it("attraversa il cambio d'ora restando a mezzanotte", () => {
    const d = addDays(new Date(2026, 9, 24, 12).getTime(), 2); // 25 ott: fine ora legale
    expect(dayKey(d)).toBe("2026-10-26");
    expect(new Date(d).getHours()).toBe(0);
  });
});

describe("previewIntervals", () => {
  it("etichette per una carta nuova", () => {
    expect(previewIntervals(newState(), NOW)).toEqual({ 1: "1 perc", 2: "6 perc", 3: "10 perc", 4: "4 nap" });
  });
  it("etichette per un ripasso lungo", () => {
    expect(previewIntervals(review(40), NOW)[3]).toBe("3,3 hónap");
  });
});

describe("ripasso in anticipo", () => {
  it("usa il tempo passato davvero, non l'intervallo previsto", () => {
    const last = addDays(NOW, -3);
    const s: SrsState = { phase: "review", step: 0, due: addDays(NOW, 7), interval: 10, ease: 2.5, reps: 5, lapses: 0, lastReview: last };
    const n = schedule(s, 3, NOW);
    expect(n.interval).toBe(Math.round(3 * 2.5));
  });
  it("una carta scaduta usa l'intervallo pieno", () => {
    const s: SrsState = { phase: "review", step: 0, due: NOW - 1, interval: 10, ease: 2.5, reps: 5, lapses: 0, lastReview: addDays(NOW, -10) };
    expect(schedule(s, 3, NOW).interval).toBe(25);
  });
});
