import { describe, expect, it } from "vitest";
import type { ArenaTopic } from "../src/types/content.ts";
import { applyOverride, gradeExercise, pickExercises, scoreSession, topicOf, type AnswerResult } from "../src/lib/arena.ts";

function topic(id: string, n: number): ArenaTopic {
  return {
    id, title: id, rule: "",
    exercises: Array.from({ length: n }, (_, i) => ({
      id: `${id}-${String(i + 1).padStart(3, "0")}`, type: "fill" as const, prompt: "___", answers: ["x"], rule: id, explanation: "",
    })),
  };
}

function seeded(seed: number) {
  return () => ((seed = (seed * 1103515245 + 12345) % 2 ** 31) / 2 ** 31);
}

describe("pickExercises", () => {
  it("10 esercizi diversi da un argomento", () => {
    const ex = pickExercises([topic("A16", 35)], 10, seeded(1));
    expect(ex).toHaveLength(10);
    expect(new Set(ex.map((e) => e.id)).size).toBe(10);
  });
  it("meno esercizi se l'argomento ne ha pochi", () => {
    expect(pickExercises([topic("A16", 4)], 10, seeded(2))).toHaveLength(4);
  });
  it("Torneo: distribuisce tra gli argomenti", () => {
    const ex = pickExercises([topic("A16", 30), topic("A17", 30)], 10, seeded(3));
    const counts = ex.reduce<Record<string, number>>((m, e) => ((m[topicOf(e.id)] = (m[topicOf(e.id)] ?? 0) + 1), m), {});
    expect(counts).toEqual({ A16: 5, A17: 5 });
  });
});

describe("scoreSession", () => {
  const r = (grade: AnswerResult["grade"]): AnswerResult => ({ exerciseId: "A16-001", topic: "A16", given: "", expected: "", grade });
  it("✅ 2 · 🟡 1 · ❌ 0", () => {
    const s = scoreSession([r("correct"), r("minor"), r("wrong"), r("correct")]);
    expect(s).toMatchObject({ points: 5, max: 8, outOf10: 6.3, correct: 2, minor: 1, wrong: 1 });
  });
  it("override vale ✅", () => {
    const o = applyOverride(r("wrong"));
    expect(o.grade).toBe("correct");
    expect(o.override).toBe(true);
    expect(o.originalGrade).toBe("wrong");
    expect(applyOverride(o).originalGrade).toBe("wrong");
    expect(scoreSession([o]).points).toBe(2);
  });
});

describe("gradeExercise", () => {
  const base = { id: "A16-001", prompt: "p", rule: "r", explanation: "" };
  it("mc: opzione con accento diverso è ❌, non 🟡", () => {
    const mc = { ...base, type: "mc" as const, options: ["várjátok", "várjatok"], answers: ["várjátok"] };
    expect(gradeExercise(mc, "várjátok").grade).toBe("correct");
    expect(gradeExercise(mc, "várjatok").grade).toBe("wrong");
  });
  it("fill: accento sbagliato è 🟡", () => {
    const fill = { ...base, type: "fill" as const, answers: ["ismerjük"] };
    expect(gradeExercise(fill, "ismerjuk").grade).toBe("minor");
  });
});
