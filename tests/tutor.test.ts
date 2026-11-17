import { describe, expect, it } from "vitest";
import type { ErrorRow, SessionRow } from "../src/db/db.ts";
import { buildTutorSummary, errorCards, exerciseSentence } from "../src/lib/tutor.ts";
import type { Exercise } from "../src/types/content.ts";

const NOW = new Date(2026, 10, 7, 20, 0).getTime();
const DAY = 86_400_000;
const err = (over: Partial<ErrorRow>): ErrorRow => ({
  date: NOW - DAY, topic: "A05", exerciseId: "A05-004", given: "parlamo", expected: "parliamo", grade: "wrong", type: "desinenza", ...over,
});
const session: SessionRow = { date: NOW - DAY, topics: ["A05"], points: 3, max: 6, results: [
  { exerciseId: "A05-004", given: "parlamo", grade: "wrong" },
  { exerciseId: "A05-001", given: "parlo", grade: "correct" },
  { exerciseId: "A05-002", given: "perche", grade: "minor" },
] };

describe("buildTutorSummary", () => {
  it("riassume errori per argomento e tipo, in ungherese", () => {
    const text = buildTutorSummary(
      [err({}), err({ exerciseId: "A05-002", given: "perche", expected: "perché", grade: "minor", type: "accento" }), err({ date: NOW - 20 * DAY })],
      [session], 7, NOW, (id) => (id === "A05" ? "Presente in -are" : id),
    );
    expect(text).toContain("Olaszóra · Aréna hibák, utolsó 7 nap");
    expect(text).toContain("Gyakorlások: 1 · válaszok: 3 (✅ 1 · 🟡 1 · ❌ 1)");
    expect(text).toContain("Típus szerint: ékezet 1 · végződés 1");
    expect(text).toContain("A05 Presente in -are (2)");
    expect(text).toContain("- parlamo → parliamo [végződés] A05-004 06/11");
    expect(text).toContain("- perche → perché [ékezet, 🟡] A05-002 06/11");
  });
  it("elenca a parte gli override", () => {
    const text = buildTutorSummary([err({ override: true })], [], null, NOW);
    expect(text).toContain("Ebben az időszakban nem volt hiba.");
    expect(text).toContain("„Jó volt” jelöléssel (1)");
  });
});

const fill: Exercise = { id: "A05-004", type: "fill", prompt: "Egészítsd ki: (Noi) ___ italiano. (parlare)", answers: ["parliamo"], hu: "Olaszul beszélünk.", rule: "A05: noi → -iamo", explanation: "" };

describe("errorCards", () => {
  it("frase completa per i fill", () => {
    expect(exerciseSentence(fill, "parliamo")).toBe("Parliamo italiano.");
  });
  it("una carta per esercizio, override esclusi: fronte ungherese, retro italiano", () => {
    const cards = errorCards([err({}), err({ date: NOW }), err({ exerciseId: "A05-009", override: true })], new Map([["A05-004", fill]]));
    expect(cards).toEqual([{ id: "err-A05-004", it: "Parliamo italiano.", hu: "Olaszul beszélünk.", tag: "errori-arena", note: "A05: noi → -iamo" }]);
  });
});
