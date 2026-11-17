// Scheduler SM-2 nello stile di Anki.
// - Carte nuove e "Ancora": step di apprendimento in minuti dentro la sessione.
// - Carte in ripasso: intervallo in giorni, scadenza a mezzanotte (ora locale).

export type Rating = 1 | 2 | 3 | 4; // Ancora · Difficile · Bene · Facile
export type CardPhase = "new" | "learning" | "review" | "relearning";

export interface SrsState {
  phase: CardPhase;
  /** Indice dello step di (ri)apprendimento corrente. */
  step: number;
  /** Scadenza, ms epoch. */
  due: number;
  /** Intervallo in giorni (0 finché la carta non è in ripasso). */
  interval: number;
  ease: number;
  reps: number;
  lapses: number;
  lastReview?: number;
}

export interface SrsConfig {
  learningSteps: number[]; // minuti
  relearningSteps: number[]; // minuti
  graduatingInterval: number; // giorni
  easyInterval: number; // giorni
  startingEase: number;
  minEase: number;
  easyBonus: number;
  hardFactor: number;
  maxInterval: number;
}

export const DEFAULT_CONFIG: SrsConfig = {
  learningSteps: [1, 10],
  relearningSteps: [10],
  graduatingInterval: 1,
  easyInterval: 4,
  startingEase: 2.5,
  minEase: 1.3,
  easyBonus: 1.3,
  hardFactor: 1.2,
  maxInterval: 36500,
};

const MIN = 60_000;

export function newState(cfg: SrsConfig = DEFAULT_CONFIG): SrsState {
  return { phase: "new", step: 0, due: 0, interval: 0, ease: cfg.startingEase, reps: 0, lapses: 0 };
}

/** Mezzanotte locale del giorno di `t`. */
export function startOfDay(t: number): number {
  const d = new Date(t);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

/** Mezzanotte locale di `days` giorni dopo il giorno di `t` (gestisce l'ora legale). */
export function addDays(t: number, days: number): number {
  const d = new Date(startOfDay(t));
  d.setDate(d.getDate() + days);
  return d.getTime();
}

/** "YYYY-MM-DD" in ora locale. */
export function dayKey(t: number): string {
  const d = new Date(t);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

/** Giorni di calendario tra due istanti (almeno 1). */
function elapsedDays(from: number, to: number): number {
  return Math.max(1, Math.round((startOfDay(to) - startOfDay(from)) / 86_400_000));
}

function toReview(s: SrsState, interval: number, now: number, cfg: SrsConfig): SrsState {
  const ivl = Math.min(cfg.maxInterval, Math.max(1, Math.round(interval)));
  return { ...s, phase: "review", step: 0, interval: ivl, due: addDays(now, ivl) };
}

function stepDelay(steps: number[], step: number): number {
  return (steps[Math.min(step, steps.length - 1)] ?? 1) * MIN;
}

/** Applica una risposta e restituisce il nuovo stato (non modifica `s`). */
export function schedule(s: SrsState, rating: Rating, now: number, cfg: SrsConfig = DEFAULT_CONFIG): SrsState {
  const base: SrsState = { ...s, reps: s.reps + 1, lastReview: now };

  if (s.phase === "new" || s.phase === "learning" || s.phase === "relearning") {
    const relearn = s.phase === "relearning";
    const steps = relearn ? cfg.relearningSteps : cfg.learningSteps;
    const phase: CardPhase = relearn ? "relearning" : "learning";
    const step = s.phase === "new" ? 0 : s.step;

    switch (rating) {
      case 1:
        return { ...base, phase, step: 0, due: now + stepDelay(steps, 0) };
      case 2: {
        // Difficile: ripete lo step; sul primo step, media tra il primo e il secondo (come Anki).
        const delay =
          step === 0 && steps.length > 1 ? ((steps[0]! + steps[1]!) / 2) * MIN : stepDelay(steps, step) * (steps.length > 1 ? 1 : 1.5);
        return { ...base, phase, step, due: now + delay };
      }
      case 3: {
        const next = step + 1;
        if (next >= steps.length) {
          return toReview(base, relearn ? s.interval : cfg.graduatingInterval, now, cfg);
        }
        return { ...base, phase, step: next, due: now + stepDelay(steps, next) };
      }
      case 4:
        return toReview(base, relearn ? s.interval + 1 : cfg.easyInterval, now, cfg);
    }
  }

  // phase === "review"
  // Ripasso in anticipo: l'intervallo di partenza è il tempo passato davvero, non quello previsto.
  const ivl = now < s.due && s.lastReview !== undefined ? Math.min(s.interval, elapsedDays(s.lastReview, now)) : s.interval;
  switch (rating) {
    case 1: {
      const ease = Math.max(cfg.minEase, s.ease - 0.2);
      return {
        ...base,
        phase: "relearning",
        step: 0,
        ease,
        lapses: s.lapses + 1,
        interval: 1,
        due: now + stepDelay(cfg.relearningSteps, 0),
      };
    }
    case 2:
      return toReview({ ...base, ease: Math.max(cfg.minEase, s.ease - 0.15) }, Math.max(ivl + 1, ivl * cfg.hardFactor), now, cfg);
    case 3:
      return toReview(base, Math.max(ivl + 1, ivl * s.ease), now, cfg);
    case 4: {
      const ease = s.ease + 0.15;
      return toReview({ ...base, ease }, Math.max(ivl + 1, ivl * s.ease * cfg.easyBonus), now, cfg);
    }
  }
}

/** Testo breve del prossimo intervallo per ogni pulsante: "1 perc", "10 perc", "1 nap", "4 nap", "2,5 hónap". */
export function previewIntervals(s: SrsState, now: number, cfg: SrsConfig = DEFAULT_CONFIG): Record<Rating, string> {
  const out = {} as Record<Rating, string>;
  for (const r of [1, 2, 3, 4] as Rating[]) {
    const n = schedule(s, r, now, cfg);
    out[r] = n.phase === "review" ? formatDays(n.interval) : formatMinutes(Math.round((n.due - now) / MIN));
  }
  return out;
}

function formatMinutes(m: number): string {
  return m < 60 ? `${m} perc` : `${Math.round(m / 60)} óra`;
}

function formatDays(d: number): string {
  if (d < 30) return `${d} nap`;
  if (d < 365) return `${(d / 30).toFixed(1).replace(".", ",").replace(",0", "")} hónap`;
  return `${(d / 365).toFixed(1).replace(".", ",").replace(",0", "")} év`;
}
