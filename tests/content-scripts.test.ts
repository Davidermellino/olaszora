import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { parseLesson } from "../src/lib/lessons.ts";
import { duplicateIds, lessonCards } from "../src/lib/vocab.ts";
import type { VocabFile } from "../src/types/content.ts";

const md = (rows: string) => `# 3. lecke — Terza lezione\n## Titolo — Cím\n\n| # | Ki | Olasz | Magyar |\n|---|---|---|---|\n| 1 | Narratore | Ciao. | Szia. |\n\n## Szavak\n| id | Olasz | Magyar |\n|---|---|---|\n${rows}`;

describe("lessonCards", () => {
  it("una carta per riga della tabella Szavak, fronte ungherese", () => {
    const l = parseLesson(md("| L03-001 | la famiglia | a család |\n| L03-002 | strano \\| strana | furcsa |"), "L03.md");
    const { cards, warnings } = lessonCards([l]);
    expect(warnings).toEqual([]);
    expect(cards).toEqual([
      { id: "L03-001", it: "la famiglia", hu: "a család", tag: "szavak", lesson: "L03" },
      { id: "L03-002", it: "strano | strana", hu: "furcsa", tag: "szavak", lesson: "L03" },
    ]);
  });
  it("segnala id sbagliati o di un'altra lezione", () => {
    const l = parseLesson(md("| 3-1 | a | b |\n| L04-001 | c | d |"), "L03.md");
    expect(lessonCards([l]).warnings).toHaveLength(2);
  });
  it("duplicateIds", () => {
    expect(duplicateIds([{ id: "a" }, { id: "b" }, { id: "a" }] as never)).toEqual(["a"]);
  });
});

describe("content/vocab/parole.json", () => {
  const data = JSON.parse(readFileSync(fileURLToPath(new URL("../content/vocab/parole.json", import.meta.url)), "utf8")) as VocabFile;
  it("id unici e stabili", () => {
    expect(duplicateIds(data.cards)).toEqual([]);
    for (const c of data.cards) expect(c.id).toMatch(/^L\d\d-\d{3}$/);
  });
  it("ogni vecchio id della vecchia app ha una carta", () => {
    const legacy = JSON.parse(readFileSync(fileURLToPath(new URL("../content/legacy-ids.json", import.meta.url)), "utf8")) as Record<string, string>;
    const ids = new Set(data.cards.map((c) => c.id));
    for (const [oldId, id] of Object.entries(legacy)) expect(ids.has(id), oldId).toBe(true);
  });
});
