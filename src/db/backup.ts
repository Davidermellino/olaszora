// Export / import di tutti i dati locali in un file JSON.
import { TABLES, type ArenaDB } from "./db.ts";

export const BACKUP_APP = "olaszora";
export const BACKUP_VERSION = 1;

export interface Backup {
  app: typeof BACKUP_APP;
  version: number;
  exportedAt: string;
  tables: Record<(typeof TABLES)[number], unknown[]>;
}

export async function exportAll(db: ArenaDB, now = Date.now()): Promise<Backup> {
  const tables = {} as Backup["tables"];
  await db.transaction("r", TABLES.map((t) => db.table(t)), async () => {
    for (const t of TABLES) tables[t] = await db.table(t).toArray();
  });
  return { app: BACKUP_APP, version: BACKUP_VERSION, exportedAt: new Date(now).toISOString(), tables };
}

/** Nome del file: olaszora-mentes-2026-11-07.json */
export function backupFileName(now = Date.now()): string {
  return `olaszora-mentes-${new Date(now).toISOString().slice(0, 10)}.json`;
}

export class BackupError extends Error {}

/** Controlla il file prima di toccare il database. */
export function parseBackup(text: string): Backup {
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    throw new BackupError("A fájl nem érvényes JSON.");
  }
  const b = data as Partial<Backup>;
  if (!b || b.app !== BACKUP_APP) throw new BackupError("A fájl nem ennek az alkalmazásnak a mentése.");
  if (typeof b.version !== "number" || b.version > BACKUP_VERSION) {
    throw new BackupError(`Nem támogatott mentésverzió (${String(b.version)}). Frissítsd az alkalmazást.`);
  }
  if (!b.tables || typeof b.tables !== "object") throw new BackupError("A mentésben nincsenek adatok.");
  for (const t of TABLES) {
    const rows = (b.tables as Record<string, unknown>)[t];
    if (rows !== undefined && !Array.isArray(rows)) throw new BackupError(`Érvénytelen tábla: „${t}”.`);
  }
  return b as Backup;
}

/** Sostituisce tutti i dati locali con quelli del backup (in un'unica transazione). */
export async function importAll(db: ArenaDB, backup: Backup): Promise<Record<string, number>> {
  const counts: Record<string, number> = {};
  await db.transaction("rw", TABLES.map((t) => db.table(t)), async () => {
    for (const t of TABLES) {
      const rows = (backup.tables[t] ?? []) as object[];
      await db.table(t).clear();
      if (rows.length) await db.table(t).bulkAdd(rows);
      counts[t] = rows.length;
    }
  });
  return counts;
}
