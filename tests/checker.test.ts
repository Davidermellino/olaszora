import { describe, expect, it } from "vitest";
import { accentPositions, checkAnswer, normalize, stripAccents } from "../src/lib/checker.ts";
import { classifyError } from "../src/lib/errorType.ts";

describe("normalize", () => {
  it("ignora maiuscole, spazi e punteggiatura", () => {
    expect(normalize("  Látom a  várost! ")).toBe("látom a várost");
    expect(normalize("„Hol van?” – kérdezi a rendőr.")).toBe("hol van kérdezi a rendőr");
  });
  it("tiene il trattino dentro la parola", () => {
    expect(normalize("Nézik a tv-t.")).toBe("nézik a tv-t");
  });
  it("unifica NFC e NFD", () => {
    expect(normalize("látom")).toBe("látom");
  });
});

describe("stripAccents", () => {
  it("toglie accenti ungheresi e gravi", () => {
    expect(stripAccents("áéíóöőúüű")).toBe("aeiooouuu");
    expect(stripAccents("làtok")).toBe("latok");
  });
});

describe("checkAnswer ✅", () => {
  it("risposta esatta", () => {
    expect(checkAnswer("Látom.", ["Látom."]).grade).toBe("correct");
  });
  it("maiuscole, spazi, punto finale", () => {
    expect(checkAnswer("  látom ", ["Látom."]).grade).toBe("correct");
    expect(checkAnswer("hozzátok a kaviárt", ["Hozzátok a kaviárt?"]).grade).toBe("correct");
  });
  it("qualsiasi variante accettata", () => {
    const r = checkAnswer("vizet iszok", ["Vizet iszom.", "Vizet iszok."]);
    expect(r.grade).toBe("correct");
    expect(r.expected).toBe("Vizet iszok.");
  });
});

describe("checkAnswer 🟡 (solo accenti)", () => {
  it("accento mancante", () => {
    const r = checkAnswer("keressük a pincert", ["Keressük a pincért."]);
    expect(r.grade).toBe("minor");
    expect(r.accent?.positions).toEqual([15]);
  });
  it("una lettera in più non è un errore di accento", () => {
    // Nel BOSS del 07/11 "pinceret" era stato dato 🟡; qui la regola è stretta: ❌.
    expect(checkAnswer("keressük a pinceret", ["Keressük a pincért."]).grade).toBe("wrong");
  });
  it("accento in più (lunghezza aggiunta)", () => {
    expect(checkAnswer("olvásad", ["olvasod"]).grade).toBe("wrong"); // anche la desinenza è sbagliata
    expect(checkAnswer("olvásod", ["olvasod"]).grade).toBe("minor");
  });
  it("ő/ö e ű/ü sono errori minori", () => {
    expect(checkAnswer("öt", ["őt"]).grade).toBe("minor");
    expect(checkAnswer("kuldi", ["küldi"]).grade).toBe("minor");
  });
  it("accento grave al posto dell'acuto", () => {
    const r = checkAnswer("làtom", ["látom"]);
    expect(r.grade).toBe("minor");
    expect(r.accent?.positions).toEqual([1]);
  });
  it("lunghezze invertite: tutte evidenziate", () => {
    const r = checkAnswer("farádt", ["fáradt"]);
    expect(r.grade).toBe("minor");
    expect(r.accent?.positions).toEqual([1, 3]);
  });
});

describe("checkAnswer ❌", () => {
  it("desinenza sbagliata", () => {
    const r = checkAnswer("váritek", ["várjátok"]);
    expect(r.grade).toBe("wrong");
    expect(r.expected).toBe("várjátok");
  });
  it("indicativo vs imperativo non è un errore di accento", () => {
    // játsszatok/játsszátok differiscono solo per l'accento: è 🟡 per il checker,
    // ma il voto resta un errore (non ✅).
    expect(checkAnswer("játsszatok", ["játsszátok"]).grade).toBe("minor");
    expect(checkAnswer("várjatok", ["várjátok"]).grade).toBe("minor");
  });
  it("sceglie la risposta più vicina come attesa", () => {
    const r = checkAnswer("a pincert keresuk", ["Keressük a pincért.", "A pincért keressük."]);
    expect(r.grade).toBe("wrong");
    expect(r.expected).toBe("A pincért keressük.");
  });
  it("risposta vuota", () => {
    expect(checkAnswer("", ["Látom."]).grade).toBe("wrong");
  });
});

describe("accentPositions", () => {
  it("posizioni diverse", () => {
    expect(accentPositions("ket", "két")).toEqual([1]);
  });
});

describe("classifyError", () => {
  it("accento", () => expect(classifyError("ket", "két", "minor")).toBe("accento"));
  it("ordine", () => expect(classifyError("A könyvet olvasom", "Olvasom a könyvet", "wrong")).toBe("ordine"));
  it("desinenza", () => expect(classifyError("Váritek az orvost", "Várjátok az orvost", "wrong")).toBe("desinenza"));
  it("lessico", () => expect(classifyError("Nézem a tévét", "Látom a tévét", "wrong")).toBe("lessico"));
  it("nessun errore", () => expect(classifyError("x", "x", "correct")).toBeNull());
});

describe("italiano", () => {
  it("🟡 se manca solo l'accento, con le lettere evidenziate", () => {
    const r = checkAnswer("perche", ["perché"]);
    expect(r.grade).toBe("minor");
    expect(r.accent).toEqual({ given: "perche", expected: "perché", positions: [5] });
    expect(checkAnswer("citta", ["città"]).grade).toBe("minor");
    expect(checkAnswer("piu", ["più"]).grade).toBe("minor");
  });
  it("🟡 anche per è/é e per l'accento scritto con l'apostrofo", () => {
    expect(checkAnswer("perchè", ["perché"]).grade).toBe("minor");
    expect(checkAnswer("perche'", ["perché"]).grade).toBe("minor");
    expect(checkAnswer("Maria e bella", ["Maria è bella."]).grade).toBe("minor");
  });
  it("✅ con l'apostrofo diritto o tipografico", () => {
    expect(checkAnswer("C’è l’Italia", ["C'è l'Italia."]).grade).toBe("correct");
    expect(checkAnswer("anch'io", ["Anch’io"]).grade).toBe("correct");
  });
  it("❌ se cambia una lettera, anche senza accenti", () => {
    expect(checkAnswer("parlamo", ["parliamo"]).grade).toBe("wrong");
    expect(checkAnswer("cita", ["città"]).grade).toBe("wrong");
  });
});
