/** Data ISO della build (vite.config.ts → define). */
declare const __BUILD_TIME__: string;

/** Battute dei dialoghi che hanno l'mp3, per lezione: { "L01": [1, 2, …] } (vite.config.ts → define). */
declare const __AUDIO__: Record<string, number[]>;

/** Ripristino definito in index.html: toglie service worker e cache, non i progressi. */
interface Window { __arenaReset?: () => void }
