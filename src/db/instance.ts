import { ArenaDB } from "./db.ts";

export const db = new ArenaDB();

/** Chiede al browser di non cancellare i dati (IndexedDB) quando manca spazio. */
export async function requestPersistence(): Promise<boolean> {
  try {
    return (await navigator.storage?.persist?.()) ?? false;
  } catch {
    return false;
  }
}
