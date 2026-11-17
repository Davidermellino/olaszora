// Hook di dati condivisi tra le schermate.
import { useLiveQuery } from "dexie-react-hooks";
import { useEffect, useMemo, useState } from "react";
import { cards as contentCards, exerciseById } from "./content.ts";
import { db } from "./db/instance.ts";
import { DEFAULT_SETTINGS, loadSettings, type Settings } from "./db/settings.ts";
import { errorCards } from "./lib/tutor.ts";
import type { Card } from "./types/content.ts";

export function useSettings(): Settings {
  return useLiveQuery(() => loadSettings(db), [], DEFAULT_SETTINGS);
}

/** Carte dei CSV + carte generate dagli errori dell'Arena. */
export function useAllCards(): Card[] {
  const errors = useLiveQuery(() => db.errors.toArray(), [], []);
  return useMemo(() => [...contentCards, ...errorCards(errors, exerciseById)], [errors]);
}

/** Applica il tema: "auto" segue il sistema. */
export function useTheme(theme: Settings["theme"]): void {
  useEffect(() => {
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const apply = () => {
      const t = theme === "auto" ? (mq.matches ? "dark" : "light") : theme;
      document.documentElement.dataset.theme = t;
      document.querySelectorAll('meta[name="theme-color"]').forEach((m) => m.setAttribute("content", t === "dark" ? "#000000" : "#f2f4f7"));
    };
    apply();
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, [theme]);
}

/** Un "adesso" che si aggiorna ogni minuto (per le carte in apprendimento). */
export function useNow(intervalMs = 30_000): number {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);
  return now;
}

/** Messaggio breve in basso ("Copiato"). */
export function useToast(): [string | null, (msg: string) => void] {
  const [msg, setMsg] = useState<string | null>(null);
  useEffect(() => {
    if (!msg) return;
    const id = setTimeout(() => setMsg(null), 2200);
    return () => clearTimeout(id);
  }, [msg]);
  return [msg, setMsg];
}
