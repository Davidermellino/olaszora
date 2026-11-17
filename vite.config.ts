import { copyFileSync, createReadStream, existsSync, mkdirSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

// GitHub Pages serve il sito sotto /olaszora/
const base = "/olaszora/";

// Audio dei dialoghi (generato da scripts/tts-elevenlabs.ts): content/audio/L01/01.mp3 → audio/L01/01.mp3.
// Solo per le lezioni che hanno un file in content/lessons/. In sviluppo li serve Vite,
// nella build vengono copiati in dist/ ed entrano nella copia offline (sono file piccoli).
const root = fileURLToPath(new URL(".", import.meta.url));
const audioDir = join(root, "content", "audio");
const lessonDir = join(root, "content", "lessons");
const lessonIds = (existsSync(lessonDir) ? readdirSync(lessonDir) : []).flatMap((f) => /^(L\d+)\.md$/.exec(f)?.[1] ?? []);
/** { "L01": [1, 2, …] }: le battute che hanno l'mp3. */
const audioLines: Record<string, number[]> = Object.fromEntries(
  lessonIds
    .map((id) => {
      const dir = join(audioDir, id);
      const nums = (existsSync(dir) ? readdirSync(dir) : []).flatMap((f) => (/^(\d+)\.mp3$/.exec(f) ? [Number(f.slice(0, -4))] : []));
      return [id, nums.sort((a, b) => a - b)] as const;
    })
    .filter(([, nums]) => nums.length > 0),
);
const audioFile = (id: string, n: number) => join(audioDir, id, `${String(n).padStart(2, "0")}.mp3`);

function lessonAudio(): Plugin {
  let build = false;
  let outDir = "dist";
  return {
    name: "lesson-audio",
    configResolved(c) { build = c.command === "build"; outDir = join(c.root, c.build.outDir); },
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const m = /\/audio\/(L\d+)\/(\d+)\.mp3(?:\?.*)?$/.exec(req.url ?? "");
        if (!m || !audioLines[m[1]!]?.includes(Number(m[2]))) return next();
        const file = audioFile(m[1]!, Number(m[2]));
        const size = statSync(file).size;
        // Safari chiede l'audio a pezzi (Range): senza risposta 206 non parte.
        const range = /^bytes=(\d*)-(\d*)$/.exec(req.headers.range ?? "");
        const start = range && range[1] ? Number(range[1]) : 0;
        const end = range && range[2] ? Math.min(Number(range[2]), size - 1) : size - 1;
        res.writeHead(range ? 206 : 200, {
          "Content-Type": "audio/mpeg",
          "Accept-Ranges": "bytes",
          "Content-Length": end - start + 1,
          ...(range ? { "Content-Range": `bytes ${start}-${end}/${size}` } : {}),
        });
        createReadStream(file, { start, end }).pipe(res);
      });
    },
    // Copiati prima che il service worker venga generato, così entrano nella copia offline.
    writeBundle() {
      if (!build) return;
      let n = 0;
      for (const [id, nums] of Object.entries(audioLines)) {
        const out = join(outDir, "audio", id);
        mkdirSync(out, { recursive: true });
        for (const k of nums) { copyFileSync(audioFile(id, k), join(out, `${String(k).padStart(2, "0")}.mp3`)); n++; }
      }
      if (n) console.log(`✓ audio: ${n} battute di ${Object.keys(audioLines).length} lezioni copiate in ${join(outDir, "audio")}`);
    },
  };
}

export default defineConfig({
  base,
  define: {
    // Data e ora della build, mostrate in Impostazioni per capire se il telefono ha l'ultima versione.
    __BUILD_TIME__: JSON.stringify(new Date().toISOString()),
    // Battute dei dialoghi che hanno l'audio.
    __AUDIO__: JSON.stringify(audioLines),
  },
  // Codice compatibile anche con iPhone non aggiornatissimi (Safari 14+).
  build: { target: ["es2020", "safari14"] },
  plugins: [
    react(),
    lessonAudio(),
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: ["favicon.svg", "apple-touch-icon.png"],
      manifest: {
        name: "Olaszóra",
        short_name: "Olaszóra",
        description: "Olasz nyelvleckék, kártyák és nyelvtani gyakorlatok magyaroknak.",
        lang: "hu",
        start_url: base,
        scope: base,
        display: "standalone",
        background_color: "#f8f8f8",
        theme_color: "#f8f8f8",
        icons: [
          { src: "icon-192.png", sizes: "192x192", type: "image/png" },
          { src: "icon-512.png", sizes: "512x512", type: "image/png" },
          { src: "icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
        ],
      },
      workbox: {
        globPatterns: ["**/*.{js,css,html,svg,png,woff2,json,mp3}"],
        maximumFileSizeToCacheInBytes: 5 * 1024 * 1024,
        navigateFallback: `${base}index.html`,
      },
    }),
  ],
});
