// Controlla content/arena/*.json. Esce con errore se qualcosa non va (blocca il deploy).
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { validateTopic } from "../src/lib/validate.ts";

const dir = join(fileURLToPath(new URL("..", import.meta.url)), "content", "arena");
const files = (existsSync(dir) ? readdirSync(dir) : []).filter((f) => f.endsWith(".json")).sort();
const errors: string[] = [];
let total = 0;
for (const f of files) {
  let data: unknown;
  try {
    data = JSON.parse(readFileSync(join(dir, f), "utf8"));
  } catch (e) {
    errors.push(`${f}: JSON non valido (${(e as Error).message})`);
    continue;
  }
  const errs = validateTopic(f, data);
  errors.push(...errs);
  const n = (data as { exercises?: unknown[] }).exercises?.length ?? 0;
  total += n;
  if (!errs.length) console.log(`✓ content/arena/${f} (${n} esercizi)`);
}
if (errors.length) {
  errors.forEach((e) => console.error("✗ " + e));
  process.exit(1);
}
console.log(`Arena: ${files.length} argomenti, ${total} esercizi, tutto ok.`);
