// Logica della sintesi vocale dei dialoghi con ElevenLabs (usata da scripts/tts-elevenlabs.ts e dai test).
// La chiamata HTTP passa da `fetch`, che i test sostituiscono con un'API finta.
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { parseLesson, speakable, type Lesson, type Pair } from "../src/lib/lessons.ts";

export const API = "https://api.elevenlabs.io";

/**
 * Impostazioni della voce. Entrano nell'hash: se cambiano, tutte le battute vengono rigenerate.
 * - eleven_multilingual_v2: il modello che la documentazione consiglia per qualità e narrazione (italiano incluso).
 *   Con questo modello `language_code` non è supportato: la lingua la riconosce dal testo.
 * - speed 0.9: un po' più lento del normale, per principianti.
 * - stability un po' più alta del default (0.5): lettura più regolare, meno teatrale.
 */
export const TTS = {
  model_id: "eleven_multilingual_v2",
  output_format: "mp3_44100_64",
  voice_settings: { stability: 0.6, similarity_boost: 0.75, style: 0, use_speaker_boost: true, speed: 0.9 },
} as const;

/** Il modello accetta `language_code`? (multilingual_v2 no: «not supported for multilingual_v2 models») */
export function languageCodeFor(model: string): string | undefined {
  return /multilingual_v2/.test(model) ? undefined : "it";
}

export interface ManifestEntry {
  hash: string;
  voice: string;
  who: string;
  text: string;
  chars: number;
}
/** content/audio/manifest.json: "L01/01.mp3" → come è stato generato. */
export type Manifest = Record<string, ManifestEntry>;
/** content/audio/voices.json: personaggio → voice_id. */
export type Voices = Record<string, string>;

export interface Job {
  lesson: string;
  /** "L01/01.mp3" */
  file: string;
  who: string;
  text: string;
  voice: string | undefined;
  hash: string;
}

/** Le battute lette ad alta voce: il dialogo, o nei ripassi l'esercizio di ripasso (come src/lessons.ts). */
export function spokenLines(l: Lesson): Pair[] {
  return l.lines.length ? l.lines : (l.exercises.find((e) => e.review)?.items ?? []);
}

export function jobHash(text: string, voice: string, settings: object = TTS): string {
  return createHash("sha256").update(JSON.stringify({ text, voice, settings })).digest("hex").slice(0, 16);
}

const pad = (n: number) => String(n).padStart(2, "0");

/** Numeri in lettere per il titolo letto («Lezione tre»). */
const UNITS = ["zero", "uno", "due", "tre", "quattro", "cinque", "sei", "sette", "otto", "nove", "dieci", "undici", "dodici", "tredici", "quattordici", "quindici", "sedici", "diciassette", "diciotto", "diciannove"];
const TENS = ["", "", "venti", "trenta", "quaranta", "cinquanta", "sessanta", "settanta", "ottanta", "novanta"];
export function numberWord(n: number): string {
  if (n < 20) return UNITS[n]!;
  if (n < 100) {
    const t = TENS[Math.floor(n / 10)]!;
    const u = n % 10;
    if (u === 0) return t;
    // ventuno, ventotto: la vocale finale cade davanti a uno e otto; ventitré con l'accento
    const base = u === 1 || u === 8 ? t.slice(0, -1) : t;
    return base + (u === 3 ? "tré" : UNITS[u]!);
  }
  return String(n);
}

/** «Lezione tre. Una strana famiglia.» */
export function titleText(l: Lesson): string {
  const title = speakable(l.titleIt).replace(/[.!?…]+$/, "");
  return `Lezione ${numberWord(l.n)}. ${title}.`;
}

export const TITLE_VOICE = "Narratore";

/** Tutte le battute da sintetizzare per le lezioni date (più il titolo letto, per lesson.mp3). */
export function buildJobs(lessons: Lesson[], voices: Voices, settings: object = TTS): Job[] {
  const jobs: Job[] = [];
  for (const l of lessons) {
    const lines = spokenLines(l);
    if (!lines.length) continue;
    const add = (file: string, who: string, text: string) => {
      const voice = voices[who];
      jobs.push({ lesson: l.id, file: `${l.id}/${file}`, who, text, voice, hash: jobHash(text, voice ?? "", settings) });
    };
    add("title.mp3", TITLE_VOICE, titleText(l));
    for (const p of lines) add(`${pad(p.n)}.mp3`, p.who ?? "", speakable(p.it));
  }
  return jobs;
}

/** Le battute da (ri)generare: nuove, cambiate, o con il file mancante. */
export function pendingJobs(jobs: Job[], manifest: Manifest, audioDir: string): Job[] {
  return jobs.filter((j) => manifest[j.file]?.hash !== j.hash || !existsSync(join(audioDir, j.file)));
}

export function loadLessons(lessonDir: string, only?: string): Lesson[] {
  return readdirSync(lessonDir)
    .filter((f) => /^L\d+\.md$/.test(f))
    .map((f) => parseLesson(readFileSync(join(lessonDir, f), "utf8"), f))
    .filter((l) => !only || l.id === only)
    .sort((a, b) => a.n - b.n);
}

export function readJson<T>(file: string, fallback: T): T {
  return existsSync(file) ? (JSON.parse(readFileSync(file, "utf8")) as T) : fallback;
}

/** Legge ELEVENLABS_API_KEY da .env.local (o dall'ambiente). Non la stampa mai. */
export function readApiKey(root: string, env: NodeJS.ProcessEnv = process.env): string | null {
  if (env.ELEVENLABS_API_KEY) return env.ELEVENLABS_API_KEY.trim();
  const file = join(root, ".env.local");
  if (!existsSync(file)) return null;
  for (const line of readFileSync(file, "utf8").split(/\r?\n/)) {
    const m = /^\s*(?:export\s+)?ELEVENLABS_API_KEY\s*=\s*(.*)\s*$/.exec(line);
    if (m) return m[1]!.replace(/^["']|["']$/g, "").trim() || null;
  }
  return null;
}

export type Fetch = typeof fetch;
export const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export class TtsError extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
  }
}

/**
 * Una chiamata a ElevenLabs con nuovi tentativi per 429 (troppe richieste) e 5xx:
 * aspetta Retry-After se c'è, altrimenti 2s, 4s, 8s…
 */
export async function synthesize(
  text: string,
  voice: string,
  key: string,
  opts: { fetch?: Fetch; wait?: (ms: number) => Promise<void>; retries?: number; settings?: typeof TTS } = {},
): Promise<Uint8Array> {
  const f = opts.fetch ?? fetch;
  const wait = opts.wait ?? sleep;
  const s = opts.settings ?? TTS;
  const retries = opts.retries ?? 5;
  const language_code = languageCodeFor(s.model_id);
  const body = JSON.stringify({ text, model_id: s.model_id, voice_settings: s.voice_settings, ...(language_code ? { language_code } : {}) });
  for (let attempt = 0; ; attempt++) {
    const res = await f(`${API}/v1/text-to-speech/${encodeURIComponent(voice)}?output_format=${s.output_format}`, {
      method: "POST",
      headers: { "xi-api-key": key, "Content-Type": "application/json", Accept: "audio/mpeg" },
      body,
    });
    if (res.ok) return new Uint8Array(await res.arrayBuffer());
    const retryable = res.status === 429 || res.status >= 500;
    if (!retryable || attempt >= retries) {
      // Il corpo dell'errore di ElevenLabs non contiene la chiave: si può mostrare.
      const detail = (await res.text().catch(() => "")).slice(0, 300);
      throw new TtsError(`ElevenLabs ${res.status}: ${detail}`, res.status);
    }
    const after = Number(res.headers.get("retry-after"));
    await wait(Number.isFinite(after) && after > 0 ? after * 1000 : 2000 * 2 ** attempt);
  }
}

export interface RunOptions {
  root: string;
  lesson?: string;
  dryRun?: boolean;
  key?: string | null;
  fetch?: Fetch;
  wait?: (ms: number) => Promise<void>;
  /** Pausa fra una richiesta e l'altra. */
  pauseMs?: number;
  log?: (msg: string) => void;
}

export interface RunResult {
  pending: number;
  chars: number;
  generated: number;
  missingVoices: string[];
  removed: string[];
}

/** Genera (o conta, con dryRun) gli mp3 delle battute cambiate e aggiorna manifest.json. */
export async function run(o: RunOptions): Promise<RunResult> {
  const log = o.log ?? console.log;
  const audioDir = join(o.root, "content", "audio");
  const manifestFile = join(audioDir, "manifest.json");
  const voices = readJson<Voices>(join(audioDir, "voices.json"), {});
  const manifest = readJson<Manifest>(manifestFile, {});
  const lessons = loadLessons(join(o.root, "content", "lessons"), o.lesson);
  if (o.lesson && lessons.length === 0) throw new Error(`Lezione ${o.lesson} non trovata in content/lessons/`);

  const jobs = buildJobs(lessons, voices);
  const todo = pendingJobs(jobs, manifest, audioDir);
  const chars = todo.reduce((n, j) => n + [...j.text].length, 0);
  const missingVoices = [...new Set(todo.filter((j) => !j.voice).map((j) => j.who || "(senza Ki)"))].sort();

  // File che non corrispondono più a nessuna battuta (battuta tolta): solo nelle lezioni elaborate.
  const ids = new Set(lessons.map((l) => l.id));
  const wanted = new Set(jobs.map((j) => j.file));
  const removed = Object.keys(manifest).filter((f) => ids.has(f.split("/")[0]!) && !wanted.has(f) && !f.endsWith("/lesson.mp3"));

  const byLesson = new Map<string, number>();
  for (const j of todo) byLesson.set(j.lesson, (byLesson.get(j.lesson) ?? 0) + [...j.text].length);
  for (const [l, n] of byLesson) log(`  ${l}: ${todo.filter((j) => j.lesson === l).length} file, ${n} caratteri`);
  log(`${todo.length} file da generare, ${chars} caratteri (${jobs.length - todo.length} già pronti).`);
  if (missingVoices.length) log(`Voci mancanti in content/audio/voices.json: ${missingVoices.join(", ")}`);
  if (removed.length) log(`Da togliere (battute non più presenti): ${removed.join(", ")}`);

  const result: RunResult = { pending: todo.length, chars, generated: 0, missingVoices, removed };
  if (o.dryRun) return result;
  if (missingVoices.length) throw new Error(`Mancano le voci per: ${missingVoices.join(", ")}`);
  if (todo.length && !o.key) throw new Error("Manca ELEVENLABS_API_KEY in .env.local");

  for (const f of removed) {
    rmSync(join(audioDir, f), { force: true });
    delete manifest[f];
  }
  const save = () => writeFileSync(manifestFile, JSON.stringify(sortKeys(manifest), null, 2) + "\n");
  for (const [i, j] of todo.entries()) {
    if (i > 0) await (o.wait ?? sleep)(o.pauseMs ?? 400);
    const mp3 = await synthesize(j.text, j.voice!, o.key!, { fetch: o.fetch, wait: o.wait });
    mkdirSync(join(audioDir, j.lesson), { recursive: true });
    writeFileSync(join(audioDir, j.file), mp3);
    manifest[j.file] = { hash: j.hash, voice: j.voice!, who: j.who, text: j.text, chars: [...j.text].length };
    // salvato dopo ogni file: se lo script si ferma, alla prossima riparte da dove era
    save();
    result.generated++;
    log(`✓ ${j.file} (${j.who}) ${j.text}`);
  }
  if (removed.length && !todo.length) save();
  return result;
}

function sortKeys<T>(o: Record<string, T>): Record<string, T> {
  return Object.fromEntries(Object.keys(o).sort().map((k) => [k, o[k]!]));
}

/** Elenco delle voci della libreria dell'utente (GET /v2/voices, tutte le pagine). */
export interface VoiceInfo { voice_id: string; name: string; category?: string; labels?: Record<string, string>; preview_url?: string }
export async function listVoices(key: string, f: Fetch = fetch): Promise<VoiceInfo[]> {
  const out: VoiceInfo[] = [];
  let token: string | null = null;
  do {
    const q = new URLSearchParams({ page_size: "100", include_total_count: "false", ...(token ? { next_page_token: token } : {}) });
    const res = await f(`${API}/v2/voices?${q}`, { headers: { "xi-api-key": key } });
    if (!res.ok) throw new TtsError(`ElevenLabs ${res.status}: ${(await res.text()).slice(0, 300)}`, res.status);
    const data = (await res.json()) as { voices: VoiceInfo[]; has_more: boolean; next_page_token: string | null };
    out.push(...data.voices);
    token = data.has_more ? data.next_page_token : null;
  } while (token);
  return out;
}
