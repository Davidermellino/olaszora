import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { validateTopic } from "../src/lib/validate.ts";
import { checkAnswer } from "../src/lib/checker.ts";
import { gradeExercise } from "../src/lib/arena.ts";
import type { ArenaTopic } from "../src/types/content.ts";

const dir = join(fileURLToPath(new URL("..", import.meta.url)), "content", "arena");

describe("content/arena reale", () => {
  it("la cartella content/arena esiste", () => expect(readdirSync(dir)).toBeDefined());
  for (const f of readdirSync(dir).filter((x) => x.endsWith(".json"))) {
    const topic = JSON.parse(readFileSync(join(dir, f), "utf8")) as ArenaTopic;
    it(`${f} è valido`, () => expect(validateTopic(f, topic)).toEqual([]));
    it(`${f}: ogni risposta accettata è ✅ per il checker`, () => {
      for (const e of topic.exercises) for (const a of e.answers) expect(checkAnswer(a, e.answers).grade).toBe("correct");
    });
    it(`${f}: nelle mc ogni opzione sbagliata vale ❌`, () => {
      for (const e of topic.exercises.filter((x) => x.type === "mc"))
        for (const o of e.options ?? []) {
          const g = gradeExercise(e, o).grade;
          expect(g, `${e.id}: ${o}`).toBe(e.answers.includes(o) ? "correct" : "wrong");
        }
    });
  }
});

describe("validateTopic", () => {
  it("trova gli errori tipici", () => {
    const bad = {
      id: "A99", title: "x", rule: "x",
      exercises: [
        { id: "A99-001", type: "mc", prompt: "p", options: ["a", "b"], answers: ["c"], rule: "r", explanation: "" },
        { id: "A99-001", type: "fill", prompt: "senza buco", answers: ["a"], rule: "r", explanation: "" },
        { id: "A16-003", type: "quiz", prompt: "p", answers: [], rule: "", explanation: "" },
      ],
    };
    const errs = validateTopic("A99.json", bad).join("\n");
    expect(errs).toMatch(/non è tra le options/);
    expect(errs).toMatch(/id duplicato/);
    expect(errs).toMatch(/___/);
    expect(errs).toMatch(/iniziare con "A99-"/);
    expect(errs).toMatch(/type deve essere/);
  });
});
