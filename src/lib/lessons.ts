// Legge una lezione scritta in Markdown (content/lessons/Lxx.md)
// e la divide in dialogo, note, grammatica (ripassi), esercizi e parole.
// Il formato dei file è descritto nel README.

/** Un pezzo di testo dentro una sezione. Il testo può contenere **grassetto** e *corsivo*. */
export type Block =
  | { kind: "p"; text: string }
  | { kind: "h"; text: string }
  | { kind: "list"; ordered: boolean; items: { text: string; depth: number }[] }
  | { kind: "table"; head: string[]; rows: string[][] };

export interface Section {
  title: string;
  blocks: Block[];
}

/** Una frase italiana con la sua traduzione ungherese. */
export interface Pair {
  n: number;
  /** Italiano, con i rimandi alle note (^1). */
  it: string;
  hu: string;
  /** Chi parla (colonna «Ki»), solo nei dialoghi. */
  who?: string;
}

export interface ExerciseSet {
  title: string;
  /** "translate": si legge l'italiano e si traduce. "fill": si completa l'italiano (i buchi sono in **grassetto**). */
  kind: "translate" | "fill";
  /** Esercizio di ripasso (tabella con «Ki»): ha l'audio come il dialogo. */
  review: boolean;
  items: Pair[];
}

export interface Word {
  /** Stabile per sempre: "L03-001". */
  id: string;
  it: string;
  hu: string;
}

export interface Lesson {
  /** Numero della lezione: 1, 2… */
  n: number;
  /** "L01" */
  id: string;
  /** "Prima lezione" */
  ordinal: string;
  titleIt: string;
  titleHu: string;
  /** Lezione di ripasso (ogni sette): grammatica al posto del dialogo. */
  review: boolean;
  /** Avvisi in testa al file. */
  lead: string[];
  lines: Pair[];
  /** Note al dialogo e altre sezioni. */
  notes: Section[];
  /** Solo nei ripassi: i capitoli di grammatica. */
  grammar: Section[];
  exercises: ExerciseSet[];
  words: Word[];
}

const HEADING = /^(#{1,4})\s+(.*)$/;
const LIST_ITEM = /^(\s*)(-|\d+\.)\s+(.*)$/;

function cells(line: string): string[] {
  return line
    .trim()
    .replace(/^\|/, "")
    .replace(/(?<!\\)\|$/, "")
    .split(/(?<!\\)\|/)
    .map((c) => c.trim().replace(/\\\|/g, "|"));
}

/** Divide il corpo di una sezione in paragrafi, liste e tabelle. */
export function parseBlocks(lines: string[]): Block[] {
  const out: Block[] = [];
  let i = 0;
  while (i < lines.length) {
    const line = lines[i]!;
    if (!line.trim() || /^-{3,}$/.test(line.trim())) { i++; continue; }
    if (line.trim().startsWith("|")) {
      const rows: string[][] = [];
      while (i < lines.length && lines[i]!.trim().startsWith("|")) rows.push(cells(lines[i++]!));
      const body = rows.filter((r) => !r.every((c) => /^:?-+:?$/.test(c)));
      out.push({ kind: "table", head: body[0] ?? [], rows: body.slice(1) });
      continue;
    }
    const li = LIST_ITEM.exec(line);
    if (li) {
      const items: { text: string; depth: number }[] = [];
      const ordered = li[2] !== "-";
      for (let m = LIST_ITEM.exec(lines[i] ?? ""); m; m = LIST_ITEM.exec(lines[++i] ?? "")) {
        items.push({ text: m[3]!, depth: Math.floor(m[1]!.length / 2) });
      }
      out.push({ kind: "list", ordered, items });
      continue;
    }
    out.push({ kind: "p", text: line.trim().replace(/^>\s*/, "") });
    i++;
  }
  return out;
}

const col = (head: string[], re: RegExp) => head.findIndex((h) => re.test(h));

/** Frasi da una tabella | # | Ki | Olasz | Magyar | o da una lista "1. A → B" (A a sinistra, B a destra). */
function pairs(blocks: Block[]): { left: string; right: string; who?: string; table: boolean }[] {
  const out: { left: string; right: string; who?: string; table: boolean }[] = [];
  for (const b of blocks) {
    if (b.kind === "table") {
      const it = col(b.head, /^olasz$/i);
      const hu = col(b.head, /^magyar$/i);
      const ki = col(b.head, /^ki$/i);
      if (it < 0 || hu < 0 || col(b.head, /^id$/i) >= 0) continue;
      for (const r of b.rows) out.push({ left: r[it] ?? "", right: r[hu] ?? "", table: true, ...(ki >= 0 && r[ki] ? { who: r[ki] } : {}) });
    } else if (b.kind === "list") {
      for (const x of b.items) {
        const at = x.text.indexOf(" → ");
        if (at > 0) out.push({ left: x.text.slice(0, at).trim(), right: x.text.slice(at + 3).trim(), table: false });
      }
    }
  }
  return out;
}

function words(blocks: Block[], file: string): Word[] {
  const out: Word[] = [];
  for (const b of blocks) {
    if (b.kind !== "table") continue;
    const id = col(b.head, /^id$/i);
    const it = col(b.head, /^olasz$/i);
    const hu = col(b.head, /^magyar$/i);
    if (id < 0 || it < 0 || hu < 0) throw new Error(`${file}: la tabella «Szavak» deve avere le colonne id, Olasz, Magyar`);
    for (const r of b.rows) out.push({ id: r[id] ?? "", it: r[it] ?? "", hu: r[hu] ?? "" });
  }
  return out;
}

export function parseLesson(md: string, file = ""): Lesson {
  const src = md.replace(/\r\n?/g, "\n").split("\n");
  const parts: { level: number; title: string; body: string[] }[] = [];
  for (const line of src) {
    const h = HEADING.exec(line);
    if (h) parts.push({ level: h[1]!.length, title: h[2]!.trim(), body: [] });
    else if (parts.length) parts[parts.length - 1]!.body.push(line);
  }
  const h1 = parts[0];
  if (!h1 || h1.level !== 1) throw new Error(`${file}: manca il titolo «# N. lecke — …»`);
  const num = /(\d+)/.exec(h1.title);
  if (!num) throw new Error(`${file}: manca il numero della lezione nel titolo`);
  const n = Number(num[1]);

  // "# 7. lecke — Settima lezione — Ripasso (Ismétlés)" · "# 3. lecke — Terza lezione"
  const bits = h1.title.split(" — ").slice(1);
  let ordinal = "";
  if (bits[0] && /lezione$/i.test(bits[0])) ordinal = bits.shift()!;
  let titleIt = bits.join(" — ");
  let titleHu = "";
  const paren = /^(.*?)\s*\(([^()]*)\)$/.exec(titleIt);
  if (paren) { titleIt = paren[1]!; titleHu = paren[2]!; }
  const review = /^Ripasso/i.test(titleIt);

  const lesson: Lesson = {
    n, id: `L${String(n).padStart(2, "0")}`, ordinal, titleIt, titleHu, review,
    lead: [], lines: [], notes: [], grammar: [], exercises: [], words: [],
  };

  const takeHead = (body: string[]) => {
    for (const b of parseBlocks(body)) {
      const p = pairs([b]);
      if (p.length && lesson.lines.length === 0) lesson.lines = p.map((x, i) => ({ n: i + 1, it: x.left, hu: x.right, ...(x.who ? { who: x.who } : {}) }));
      else if (b.kind === "p") lesson.lead.push(b.text);
    }
  };
  takeHead(h1.body);

  let rest = parts.slice(1);
  // senza titolo nel # : il primo ## è "Titolo italiano — traduzione", seguito dal dialogo
  if (!titleIt && rest[0] && rest[0].level === 2 && rest[0].title.includes(" — ")) {
    const at = rest[0].title.indexOf(" — ");
    lesson.titleIt = rest[0].title.slice(0, at).trim();
    lesson.titleHu = rest[0].title.slice(at + 3).trim();
    takeHead(rest[0].body);
    rest = rest.slice(1);
  }

  let current: Section | null = null;
  for (const p of rest) {
    const blocks = parseBlocks(p.body);
    if (/^Szavak/i.test(p.title)) {
      current = null;
      lesson.words.push(...words(blocks, file));
      continue;
    }
    if (/gyakorlat/i.test(p.title)) {
      current = null;
      const items = pairs(blocks);
      if (items.length === 0) continue;
      const table = items.some((x) => x.table);
      const fill = !table && items.some((x) => x.right.includes("**"));
      lesson.exercises.push({
        title: p.title,
        kind: fill ? "fill" : "translate",
        review: table,
        // nei "fill" l'ungherese è a sinistra della freccia, l'italiano (con i buchi) a destra
        items: items.map((x, i) => (fill
          ? { n: i + 1, it: x.right, hu: x.left }
          : { n: i + 1, it: x.left, hu: x.right, ...(x.who ? { who: x.who } : {}) })),
      });
      continue;
    }
    // nei ripassi i ### sono sottotitoli del capitolo ## in corso
    if (review && p.level >= 3 && current) {
      current.blocks.push({ kind: "h", text: p.title }, ...blocks);
      continue;
    }
    current = { title: p.title, blocks };
    (review ? lesson.grammar : lesson.notes).push(current);
  }
  return lesson;
}

/** Un pezzo di frase da completare: testo fisso oppure buco con la sua soluzione. */
export interface FillPart {
  text: string;
  blank: boolean;
}

/** "Qui **c'è** Roma." → testo, buco, testo. */
export function fillParts(it: string): FillPart[] {
  return it.split("**").map((text, i) => ({ text, blank: i % 2 === 1 })).filter((p) => p.text !== "");
}

/** Toglie grassetto, corsivo e rimandi alle note. */
export function plain(text: string): string {
  return text.replace(/\*+/g, "").replace(/\^\d+/g, "");
}

/**
 * Testo da mandare alla sintesi vocale: senza rimandi alle note (^1), senza le parti
 * tra parentesi quadre o tonde (traduzioni letterali) e senza Markdown.
 */
export function speakable(text: string): string {
  return text
    .replace(/\^\d+/g, "")
    .replace(/\[[^\]]*\]/g, "")
    .replace(/\([^)]*\)/g, "")
    .replace(/\*+/g, "")
    .replace(/\s+([.,;:!?…])/g, "$1")
    .replace(/\s+/g, " ")
    .trim();
}

/** Testo con grassetto, corsivo e rimandi alle note, a pezzi. */
export interface Span {
  text: string;
  bold: boolean;
  italic: boolean;
  /** Rimando a una nota (^3 → 3). */
  note?: number;
}

export function inline(text: string): Span[] {
  const out: Span[] = [];
  let bold = false;
  let italic = false;
  for (const tok of text.split(/(\*\*|\*|\^\d+)/)) {
    if (tok === "**") bold = !bold;
    else if (tok === "*") italic = !italic;
    else if (/^\^\d+$/.test(tok)) out.push({ text: tok.slice(1), bold: false, italic: false, note: Number(tok.slice(1)) });
    else if (tok) out.push({ text: tok, bold, italic });
  }
  return out;
}
