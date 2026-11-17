import type { TopicRow } from "../content.ts";

/** "6/10", "8,5/10", "–" */
export function fmtScore(v: number | null | undefined): string {
  if (v === null || v === undefined || v < 0) return "–";
  return `${String(Math.round(v * 10) / 10).replace(".", ",")}/10`;
}

/** Prossimo argomento: in coda con il punteggio migliore più basso; poi nuovi (in ordine); poi conquistati. */
export function nextTopic(rows: TopicRow[]): TopicRow | null {
  const withEx = rows.filter((r) => r.exercises > 0);
  const rank = (r: { status: string }) => (r.status === "in coda" ? 0 : r.status === "nuovo" ? 1 : 2);
  withEx.sort((a, b) => rank(a) - rank(b) || (a.best ?? -1) - (b.best ?? -1) || a.id.localeCompare(b.id));
  return withEx[0] ?? null;
}
