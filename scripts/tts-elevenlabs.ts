// Audio dei dialoghi con ElevenLabs: un mp3 per battuta in content/audio/Lxx/NN.mp3.
// Si lancia in locale (serve la chiave in .env.local), gli mp3 si committano: il deploy non chiama l'API.
//
// npm run audio                         tutte le lezioni, solo le battute nuove o cambiate
// npm run audio -- --lesson L05         una lezione sola
// npm run audio -- --dry-run            quanti caratteri invierebbe (per il costo), senza chiamare l'API
// npm run audio -- --list-voices        le voci della tua libreria ElevenLabs
// npm run audio -- --samples id1,id2    una frase di prova per ogni voce, in .audio-samples/ (non committata)
//
// Con ffmpeg crea anche Lxx/lesson.mp3: titolo letto e tutte le battute in fila, come un audio Assimil.
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { buildJobs, jobHash, listVoices, loadLessons, readApiKey, readJson, run, synthesize, type Manifest } from "./tts-core.ts";

const root = fileURLToPath(new URL("..", import.meta.url));
const args = process.argv.slice(2);
const flag = (name: string) => args.includes(name);
const value = (name: string) => {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : undefined;
};

const SAMPLE = "Buongiorno! Questa è la mia voce per le lezioni di italiano. Come stai?";

async function main() {
  const key = readApiKey(root);

  if (flag("--list-voices")) {
    if (!key) throw new Error("Manca ELEVENLABS_API_KEY in .env.local");
    const voices = await listVoices(key);
    for (const v of voices.sort((a, b) => a.name.localeCompare(b.name))) {
      const labels = Object.entries(v.labels ?? {}).map(([k, x]) => `${k}=${x}`).join(" ");
      console.log(`${v.voice_id}  ${v.name}  [${v.category ?? ""}] ${labels}`);
    }
    console.log(`${voices.length} voci.`);
    return;
  }

  const samples = value("--samples");
  if (samples) {
    if (!key) throw new Error("Manca ELEVENLABS_API_KEY in .env.local");
    const dir = join(root, ".audio-samples");
    mkdirSync(dir, { recursive: true });
    for (const id of samples.split(",").map((s) => s.trim()).filter(Boolean)) {
      writeFileSync(join(dir, `${id}.mp3`), await synthesize(SAMPLE, id, key));
      console.log(`✓ .audio-samples/${id}.mp3`);
    }
    return;
  }

  const lesson = value("--lesson");
  const dryRun = flag("--dry-run");
  await run({ root, lesson, dryRun, key });
  if (!dryRun) lessonFiles(lesson);
}

/** Lxx/lesson.mp3 con ffmpeg: titolo, pausa, battute separate da pause brevi. Rifatto solo se una parte è cambiata. */
function lessonFiles(only?: string) {
  try {
    execFileSync("ffmpeg", ["-version"], { stdio: "ignore" });
  } catch {
    console.log("ffmpeg non trovato: lesson.mp3 non creato (facoltativo).");
    return;
  }
  const audioDir = join(root, "content", "audio");
  const manifestFile = join(audioDir, "manifest.json");
  const manifest = readJson<Manifest>(manifestFile, {});
  const voices = readJson<Record<string, string>>(join(audioDir, "voices.json"), {});
  const jobs = buildJobs(loadLessons(join(root, "content", "lessons"), only), voices);
  for (const id of [...new Set(jobs.map((j) => j.lesson))]) {
    const parts = jobs.filter((j) => j.lesson === id);
    if (parts.some((p) => manifest[p.file]?.hash !== p.hash || !existsSync(join(audioDir, p.file)))) continue;
    const file = `${id}/lesson.mp3`;
    const hash = jobHash(parts.map((p) => p.hash).join(","), "lesson", { gap: [1.2, 0.8] });
    if (manifest[file]?.hash === hash && existsSync(join(audioDir, file))) continue;
    // titolo, 1,2 s di silenzio, poi ogni battuta seguita da 0,8 s
    const inputs = parts.flatMap((p) => ["-i", join(audioDir, p.file)]);
    const chain = parts
      .map((_, i) => `[${i}:a]aresample=44100,aformat=channel_layouts=mono,apad=pad_dur=${i === 0 ? 1.2 : 0.8}[a${i}]`)
      .join(";");
    const concat = `${parts.map((_, i) => `[a${i}]`).join("")}concat=n=${parts.length}:v=0:a=1[out]`;
    const out = join(audioDir, file);
    rmSync(out, { force: true });
    execFileSync("ffmpeg", ["-hide_banner", "-loglevel", "error", ...inputs, "-filter_complex", `${chain};${concat}`, "-map", "[out]", "-c:a", "libmp3lame", "-b:a", "64k", out]);
    manifest[file] = { hash, voice: "", who: "", text: `${parts.length} parti`, chars: 0 };
    writeFileSync(manifestFile, JSON.stringify(Object.fromEntries(Object.keys(manifest).sort().map((k) => [k, manifest[k]!])), null, 2) + "\n");
    console.log(`✓ ${file}`);
  }
}

main().catch((e: unknown) => {
  console.error(`✗ ${(e as Error).message}`);
  process.exit(1);
});
