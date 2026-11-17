import { existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { parseLesson } from "../src/lib/lessons.ts";
import { buildJobs, languageCodeFor, numberWord, readApiKey, run, synthesize, titleText, type Manifest } from "../scripts/tts-core.ts";

const LESSON = `# 3. lecke — Terza lezione
## Una strana famiglia — Egy furcsa család

| # | Ki | Olasz | Magyar |
|---|---|---|---|
| 1 | Narratore | La famiglia Rossi vive^1 a Roma. | A Rossi család Rómában él. |
| 2 | Narratrice | Dov'è (lett. *dove è*) Giovanni? | Hol van Giovanni? |

## Szavak
| id | Olasz | Magyar |
|---|---|---|
| L03-001 | la famiglia | a család |
`;

/** API finta: registra le richieste e risponde con un "mp3" che contiene il testo. */
function fakeApi(fail: number[] = []) {
  const calls: { url: string; body: { text: string; model_id: string; voice_settings: { speed: number }; language_code?: string }; key: string | null }[] = [];
  let n = 0;
  const f = (async (url: string, init?: RequestInit) => {
    const status = fail[n++];
    const body = JSON.parse(String(init?.body));
    calls.push({ url, body, key: new Headers(init?.headers).get("xi-api-key") });
    if (status) return new Response("busy", { status, headers: status === 429 ? { "retry-after": "1" } : {} });
    return new Response(new TextEncoder().encode(`MP3:${body.text}`), { status: 200 });
  }) as typeof fetch;
  return { f, calls };
}

function project(voices: Record<string, string>) {
  const root = mkdtempSync(join(tmpdir(), "olaszora-tts-"));
  mkdirSync(join(root, "content", "lessons"), { recursive: true });
  mkdirSync(join(root, "content", "audio"), { recursive: true });
  writeFileSync(join(root, "content", "lessons", "L03.md"), LESSON);
  writeFileSync(join(root, "content", "audio", "voices.json"), JSON.stringify(voices));
  return root;
}
const VOICES = { Narratore: "v-uomo", Narratrice: "v-donna" };
const noWait = async () => {};
const quiet = () => {};

describe("testo e titolo", () => {
  it("battute pulite: niente note, parentesi o Markdown", () => {
    const jobs = buildJobs([parseLesson(LESSON, "L03.md")], VOICES);
    expect(jobs.map((j) => [j.file, j.who, j.voice, j.text])).toEqual([
      ["L03/title.mp3", "Narratore", "v-uomo", "Lezione tre. Una strana famiglia."],
      ["L03/01.mp3", "Narratore", "v-uomo", "La famiglia Rossi vive a Roma."],
      ["L03/02.mp3", "Narratrice", "v-donna", "Dov'è Giovanni?"],
    ]);
  });
  it("numeri in lettere", () => {
    expect([1, 3, 14, 21, 23, 28, 40].map(numberWord)).toEqual(["uno", "tre", "quattordici", "ventuno", "ventitré", "ventotto", "quaranta"]);
    expect(titleText(parseLesson("# 7. lecke — Settima lezione — Ripasso (Ismétlés)\n", "L07.md"))).toBe("Lezione sette. Ripasso.");
  });
  it("language_code solo per i modelli che lo accettano", () => {
    expect(languageCodeFor("eleven_multilingual_v2")).toBeUndefined();
    expect(languageCodeFor("eleven_v3")).toBe("it");
  });
});

describe("run con l'API finta", () => {
  it("--dry-run conta i caratteri senza chiamare l'API", async () => {
    const root = project(VOICES);
    const { f, calls } = fakeApi();
    const r = await run({ root, dryRun: true, key: "k", fetch: f, wait: noWait, log: quiet });
    expect(r.pending).toBe(3);
    expect(r.chars).toBe("Lezione tre. Una strana famiglia.".length + "La famiglia Rossi vive a Roma.".length + "Dov'è Giovanni?".length);
    expect(calls).toHaveLength(0);
    expect(existsSync(join(root, "content", "audio", "manifest.json"))).toBe(false);
  });

  it("genera i file, salva il manifest e poi rigenera solo le battute cambiate", async () => {
    const root = project(VOICES);
    const api = fakeApi();
    const r = await run({ root, key: "segreta", fetch: api.f, wait: noWait, log: quiet });
    expect(r.generated).toBe(3);
    expect(api.calls[1]!.url).toBe("https://api.elevenlabs.io/v1/text-to-speech/v-uomo?output_format=mp3_44100_64");
    expect(api.calls[1]!.key).toBe("segreta");
    expect(api.calls[1]!.body.model_id).toBe("eleven_multilingual_v2");
    expect(api.calls[1]!.body.voice_settings.speed).toBeLessThan(1);
    expect(api.calls[1]!.body.language_code).toBeUndefined();
    expect(readFileSync(join(root, "content", "audio", "L03", "02.mp3"), "utf8")).toBe("MP3:Dov'è Giovanni?");
    const manifest = JSON.parse(readFileSync(join(root, "content", "audio", "manifest.json"), "utf8")) as Manifest;
    expect(Object.keys(manifest)).toEqual(["L03/01.mp3", "L03/02.mp3", "L03/title.mp3"]);
    expect(JSON.stringify(manifest)).not.toContain("segreta");

    // seconda volta: niente da fare
    const again = fakeApi();
    expect((await run({ root, key: "k", fetch: again.f, wait: noWait, log: quiet })).generated).toBe(0);
    expect(again.calls).toHaveLength(0);

    // cambia una battuta e la voce della narratrice: si rifà solo la 2
    writeFileSync(join(root, "content", "lessons", "L03.md"), LESSON.replace("Dov'è (lett. *dove è*) Giovanni?", "Dov'è Pietro?"));
    const third = fakeApi();
    const r3 = await run({ root, key: "k", fetch: third.f, wait: noWait, log: quiet });
    expect(r3.generated).toBe(1);
    expect(third.calls[0]!.body.text).toBe("Dov'è Pietro?");
  });

  it("toglie i file delle battute che non esistono più", async () => {
    const root = project(VOICES);
    await run({ root, key: "k", fetch: fakeApi().f, wait: noWait, log: quiet });
    writeFileSync(join(root, "content", "lessons", "L03.md"), LESSON.replace(/\| 2 \|.*\n/, ""));
    const r = await run({ root, key: "k", fetch: fakeApi().f, wait: noWait, log: quiet });
    expect(r.removed).toEqual(["L03/02.mp3"]);
    expect(existsSync(join(root, "content", "audio", "L03", "02.mp3"))).toBe(false);
  });

  it("si ferma se manca una voce o la chiave", async () => {
    await expect(run({ root: project({ Narratore: "v" }), key: "k", fetch: fakeApi().f, wait: noWait, log: quiet })).rejects.toThrow(/Narratrice/);
    await expect(run({ root: project(VOICES), key: null, fetch: fakeApi().f, wait: noWait, log: quiet })).rejects.toThrow(/ELEVENLABS_API_KEY/);
  });

  it("--lesson su una lezione che non c'è", async () => {
    await expect(run({ root: project(VOICES), lesson: "L99", dryRun: true, log: quiet })).rejects.toThrow(/L99/);
  });
});

describe("synthesize", () => {
  it("riprova dopo 429 rispettando Retry-After, e dopo 5xx", async () => {
    const api = fakeApi([429, 503]);
    const waits: number[] = [];
    const mp3 = await synthesize("Ciao.", "v", "k", { fetch: api.f, wait: async (ms) => { waits.push(ms); } });
    expect(new TextDecoder().decode(mp3)).toBe("MP3:Ciao.");
    expect(waits).toEqual([1000, 4000]);
  });
  it("errore subito per 401/422, dopo i tentativi per 429", async () => {
    await expect(synthesize("x", "v", "k", { fetch: fakeApi([401]).f, wait: noWait })).rejects.toThrow(/401/);
    await expect(synthesize("x", "v", "k", { fetch: fakeApi([429, 429, 429]).f, wait: noWait, retries: 2 })).rejects.toThrow(/429/);
  });
});

describe("readApiKey", () => {
  it("legge .env.local, con o senza virgolette", () => {
    const root = mkdtempSync(join(tmpdir(), "olaszora-key-"));
    expect(readApiKey(root, {})).toBeNull();
    writeFileSync(join(root, ".env.local"), '# commento\nALTRO=1\nELEVENLABS_API_KEY="abc123"\n');
    expect(readApiKey(root, {})).toBe("abc123");
    expect(readApiKey(root, { ELEVENLABS_API_KEY: "dall-ambiente" })).toBe("dall-ambiente");
  });
});
