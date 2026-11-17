import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { fillParts, inline, parseLesson, plain, speakable } from "../src/lib/lessons.ts";

const dir = fileURLToPath(new URL("../content/lessons", import.meta.url));
const files = readdirSync(dir).filter((f) => /^L\d+\.md$/.test(f)).sort();
const lessons = files.map((f) => parseLesson(readFileSync(join(dir, f), "utf8"), f));
const L = (n: number) => lessons.find((l) => l.n === n)!;

describe("lezioni", () => {
  it("ogni file ha numero, titolo, contenuto e parole", () => {
    expect(lessons.length).toBeGreaterThanOrEqual(14);
    for (const l of lessons) {
      expect(l.id).toMatch(/^L\d\d$/);
      expect(l.titleIt, l.id).not.toBe("");
      expect(l.titleHu, l.id).not.toBe("");
      expect(l.lines.length + l.exercises.length + l.grammar.length, l.id).toBeGreaterThan(0);
      expect(l.words.length, l.id).toBeGreaterThan(0);
      for (const p of [...l.lines, ...l.exercises.flatMap((e) => e.items)]) {
        expect(p.hu, l.id).not.toBe("");
        expect(p.it, l.id).not.toBe("");
      }
    }
  });

  it("ogni battuta dei dialoghi dice chi parla", () => {
    for (const l of lessons) {
      for (const p of [...l.lines, ...l.exercises.filter((e) => e.review).flatMap((e) => e.items)]) expect(p.who, `${l.id} ${p.n}`).toBeTruthy();
    }
  });

  it("L01: dialogo, note, due esercizi e parole", () => {
    const l = L(1);
    expect(l.ordinal).toBe("Prima lezione");
    expect(l.titleIt).toBe("Che mi racconti? Niente");
    expect(l.titleHu).toBe("Mi újság (Mit nekem mesélsz)? Semmi");
    expect(l.lines).toHaveLength(10);
    expect(l.lines[4]).toEqual({ n: 5, it: "Come stai^3?", hu: "Hogy vagy (Hogyan állsz)?", who: "Giovanni" });
    expect(l.notes.map((s) => s.title)).toEqual(["Jegyzetek"]);
    expect(l.exercises.map((e) => [e.kind, e.items.length])).toEqual([["translate", 6], ["fill", 6]]);
    expect(l.exercises[1]!.items[0]).toEqual({ n: 1, it: "**Come** stai?", hu: "Hogy vagy?" });
    expect(l.words[0]).toEqual({ id: "L01-001", it: "pronto", hu: "halló" });
  });

  it("i ripassi hanno la grammatica e l'esercizio di ripasso con chi parla", () => {
    for (const n of [7, 14]) {
      const l = L(n);
      expect(l.review, l.id).toBe(true);
      expect(l.titleIt).toBe("Ripasso");
      expect(l.lines, l.id).toHaveLength(0);
      expect(l.grammar.length, l.id).toBeGreaterThan(1);
      expect(l.exercises, l.id).toHaveLength(1);
      expect(l.exercises[0]!.review).toBe(true);
      expect(l.exercises[0]!.items).toHaveLength(10);
    }
    expect(L(7).grammar.map((s) => s.title)).toEqual(["1. Az ige", "2. Személyes névmások", "3. Nem és névelő", "4. Elöljárószók a ragok helyett"]);
  });
});

describe("testo", () => {
  it("fillParts divide la frase in testo e buchi", () => {
    expect(fillParts("Qui **c'è** Roma.")).toEqual([
      { text: "Qui ", blank: false }, { text: "c'è", blank: true }, { text: " Roma.", blank: false },
    ]);
  });
  it("inline riconosce grassetto, corsivo e rimandi alle note", () => {
    expect(inline("a **b** *c*^2")).toEqual([
      { text: "a ", bold: false, italic: false }, { text: "b", bold: true, italic: false },
      { text: " ", bold: false, italic: false }, { text: "c", bold: false, italic: true },
      { text: "2", bold: false, italic: false, note: 2 },
    ]);
  });
  it("plain toglie Markdown e note", () => {
    expect(plain("**Questa** è^1 l'Europa^2.")).toBe("Questa è l'Europa.");
  });
  it("speakable toglie note, parentesi e Markdown", () => {
    expect(speakable("Sono^2 qui (lett. *qui sono*) [di] **adesso** .")).toBe("Sono qui adesso.");
    expect(speakable("Il titolo è: «Il rosso e il nero».")).toBe("Il titolo è: «Il rosso e il nero».");
  });
});
