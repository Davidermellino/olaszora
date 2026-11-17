import { clampNewPerDay, NEW_PER_DAY } from "../lib/study.ts";
import type { ArenaDB } from "./db.ts";

export interface Settings {
  /** Carte nuove al giorno, 5–9. */
  newPerDay: number;
  /** Anche la direzione IT→HU. */
  reverse: boolean;
  theme: "auto" | "light" | "dark";
}

export const DEFAULT_SETTINGS: Settings = { newPerDay: NEW_PER_DAY.default, reverse: false, theme: "auto" };

export async function loadSettings(db: ArenaDB): Promise<Settings> {
  const rows = await db.settings.toArray();
  const raw = Object.fromEntries(rows.map((r) => [r.key, r.value])) as Partial<Settings>;
  return {
    newPerDay: clampNewPerDay(Number(raw.newPerDay ?? DEFAULT_SETTINGS.newPerDay)),
    reverse: typeof raw.reverse === "boolean" ? raw.reverse : DEFAULT_SETTINGS.reverse,
    theme: raw.theme === "light" || raw.theme === "dark" ? raw.theme : "auto",
  };
}

export async function saveSetting<K extends keyof Settings>(db: ArenaDB, key: K, value: Settings[K]): Promise<void> {
  const v = key === "newPerDay" ? clampNewPerDay(value as number) : value;
  await db.settings.put({ key, value: v });
}
