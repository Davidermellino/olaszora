// Controlli sui file content/arena/*.json (usati da scripts/validate-content.ts e dai test).
import type { ArenaTopic } from "../types/content.ts";
import { checkAnswer, normalize } from "./checker.ts";

const TYPES = new Set(["mc", "fill", "transform", "translate"]);

export function validateTopic(fileName: string, data: unknown): string[] {
  const errs: string[] = [];
  const err = (m: string) => errs.push(`${fileName}: ${m}`);
  const t = data as Partial<ArenaTopic>;
  if (!t || typeof t !== "object") return [`${fileName}: non è un oggetto JSON`];
  if (typeof t.id !== "string" || !/^A\d{2,3}$/.test(t.id)) err(`id argomento non valido (${String(t.id)}), atteso es. "A01"`);
  if (fileName.replace(/\.json$/, "") !== t.id) err(`il nome del file deve essere ${String(t.id)}.json`);
  if (typeof t.title !== "string" || !t.title) err("manca title");
  if (typeof t.rule !== "string" || !t.rule) err("manca rule");
  if (!Array.isArray(t.exercises) || t.exercises.length === 0) return [...errs, `${fileName}: exercises vuoto o mancante`];

  const ids = new Set<string>();
  t.exercises.forEach((e, i) => {
    const where = `esercizio ${e?.id ?? `#${i + 1}`}`;
    if (typeof e?.id !== "string" || !e.id.startsWith(`${t.id}-`)) err(`${where}: id deve iniziare con "${t.id}-"`);
    else if (ids.has(e.id)) err(`${where}: id duplicato`);
    else ids.add(e.id);
    if (!TYPES.has(e?.type)) err(`${where}: type deve essere mc, fill, transform o translate`);
    if (typeof e?.prompt !== "string" || !e.prompt) err(`${where}: manca prompt`);
    if (!Array.isArray(e?.answers) || e.answers.length === 0 || e.answers.some((a) => typeof a !== "string" || !normalize(a)))
      err(`${where}: answers deve contenere almeno una risposta non vuota`);
    if (typeof e?.rule !== "string" || !e.rule) err(`${where}: manca rule`);
    if (typeof e?.explanation !== "string") err(`${where}: manca explanation`);
    if (e?.hu !== undefined && typeof e.hu !== "string") err(`${where}: hu deve essere una stringa`);
    if (e?.type === "fill" && !e.prompt?.includes("___")) err(`${where}: nei fill il buco si scrive ___`);
    if (e?.type === "mc") {
      if (!Array.isArray(e.options) || e.options.length < 2) err(`${where}: mc richiede almeno 2 options`);
      else {
        const opts = e.options.map(normalize);
        if (new Set(opts).size !== opts.length) err(`${where}: options duplicate`);
        for (const a of e.answers ?? []) if (!opts.includes(normalize(a))) err(`${where}: la risposta "${a}" non è tra le options`);
        const right = e.options.filter((o) => checkAnswer(o, e.answers).grade === "correct");
        if (right.length !== 1) err(`${where}: deve esserci esattamente un'opzione giusta (trovate ${right.length})`);
      }
    } else if (e?.options !== undefined) err(`${where}: options solo per mc`);
  });
  return errs;
}
