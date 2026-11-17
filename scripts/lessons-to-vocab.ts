// Genera content/vocab/parole.json dalle tabelle «Szavak» di content/lessons/Lxx.md.
// Uso: npm run vocab. Il file è generato: non modificarlo a mano.
import { mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { parseLesson } from "../src/lib/lessons.ts";
import { duplicateIds, lessonCards } from "../src/lib/vocab.ts";
import type { VocabFile } from "../src/types/content.ts";

const root = fileURLToPath(new URL("..", import.meta.url));
const dir = join(root, "content", "lessons");
const files = readdirSync(dir).filter((f) => /^L\d+\.md$/.test(f)).sort();
const lessons = files.map((f) => parseLesson(readFileSync(join(dir, f), "utf8"), f)).sort((a, b) => a.n - b.n);
const { cards, warnings } = lessonCards(lessons);
warnings.forEach((w) => console.error("✗ " + w));
const dups = duplicateIds(cards);
if (dups.length) console.error(`✗ id duplicati: ${dups.join(", ")}`);
if (warnings.length || dups.length) process.exit(1);

const data: VocabFile = { source: files.map((f) => `content/lessons/${f}`).join(", "), cards };
mkdirSync(join(root, "content", "vocab"), { recursive: true });
writeFileSync(join(root, "content", "vocab", "parole.json"), JSON.stringify(data, null, 2) + "\n");
console.log(`✓ ${lessons.length} lezioni → content/vocab/parole.json (${cards.length} carte)`);
