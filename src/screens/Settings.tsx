import { useLiveQuery } from "dexie-react-hooks";
import { useRef, useState } from "react";
import { arenaTopics, cards } from "../content.ts";
import { lessons } from "../lessons.ts";
import { useSettings, useToast } from "../data.ts";
import { backupFileName, BackupError, exportAll, importAll, parseBackup } from "../db/backup.ts";
import { db } from "../db/instance.ts";
import { saveSetting, type Settings } from "../db/settings.ts";
import { NEW_PER_DAY } from "../lib/study.ts";
import { IconDownload, IconUpload } from "../ui/icons.tsx";
import { PhoneBrand } from "../ui/Mark.tsx";

const THEMES: { id: Settings["theme"]; label: string }[] = [
  { id: "auto", label: "Automatikus" }, { id: "light", label: "Világos" }, { id: "dark", label: "Sötét" },
];

const BUILD_LABEL = new Intl.DateTimeFormat("hu-HU", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }).format(new Date(__BUILD_TIME__));

export function SettingsScreen() {
  const s = useSettings();
  const [toast, showToast] = useToast();
  const [pending, setPending] = useState<{ name: string; text: string; counts: Record<string, number> } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const stats = useLiveQuery(async () => ({
    cards: await db.srs.count(), reviews: await db.reviews.count(), sessions: await db.sessions.count(), errors: await db.errors.count(),
    lastExport: (await db.settings.get("lastExport"))?.value as number | undefined,
  }), []);

  const doExport = async () => {
    const data = await exportAll(db);
    const blob = new Blob([JSON.stringify(data)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = backupFileName(); a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    await db.settings.put({ key: "lastExport", value: Date.now() });
    showToast("Mentés letöltve");
  };

  const pick = async (file: File | undefined) => {
    setError(null); setPending(null);
    if (!file) return;
    try {
      const text = await file.text();
      const b = parseBackup(text);
      setPending({ name: file.name, text, counts: Object.fromEntries(Object.entries(b.tables).map(([k, v]) => [k, v.length])) });
    } catch (e) {
      setError(e instanceof BackupError ? e.message : "A fájlt nem sikerült beolvasni.");
    } finally {
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const confirmImport = async () => {
    if (!pending) return;
    await importAll(db, parseBackup(pending.text));
    setPending(null);
    showToast("Adatok visszaállítva");
  };

  return (
    <>
      <div className="title-row">
        <div>
          <PhoneBrand />
          <h1>Beállítások</h1>
          <p className="sub">Minden ezen az eszközön marad. A mentés az egyetlen másolat a böngészőn kívül.</p>
        </div>
      </div>

      <div className="settings">
        <section className="setting">
          <div>
            <h2>Kártyák</h2>
            <p className="desc">Először mindig a mai ismétlések jönnek, utána az új kártyák a napi határig.</p>
          </div>
          <div className="well">
            <div className="row">
              <span className="grow">
                <span className="title" style={{ display: "block" }} id="npd">Új kártyák naponta</span>
                <span className="line2">{NEW_PER_DAY.min} és {NEW_PER_DAY.max} között</span>
              </span>
              <span className="stepper" role="group" aria-labelledby="npd">
                <button onClick={() => void saveSetting(db, "newPerDay", s.newPerDay - 1)} disabled={s.newPerDay <= NEW_PER_DAY.min} aria-label="Eggyel kevesebb">−</button>
                <output aria-live="polite">{s.newPerDay}</output>
                <button onClick={() => void saveSetting(db, "newPerDay", s.newPerDay + 1)} disabled={s.newPerDay >= NEW_PER_DAY.max} aria-label="Eggyel több">+</button>
              </span>
            </div>
            <label className="row" style={{ cursor: "pointer" }}>
              <span className="grow">
                <span className="title" style={{ display: "block" }}>Olasz → magyar irányban is</span>
                <span className="line2">Minden szóhoz egy második kártya, miután az első ismétlésbe került</span>
              </span>
              <input type="checkbox" className="switch" checked={s.reverse} onChange={(e) => void saveSetting(db, "reverse", e.target.checked)} />
            </label>
          </div>
        </section>

        <section className="setting">
          <div>
            <h2>Megjelenés</h2>
            <p className="desc">Az automatikus a telefon témáját követi.</p>
          </div>
          <div className="well" style={{ padding: 16 }}>
            <div className="segmented" role="group" aria-label="Téma">
              {THEMES.map((t) => (
                <button key={t.id} aria-pressed={s.theme === t.id} onClick={() => void saveSetting(db, "theme", t.id)}>{t.label}</button>
              ))}
            </div>
          </div>
        </section>

        <section className="setting">
          <div>
            <h2>Mentés</h2>
            <p className="desc">
              Ezen az eszközön: {stats ? `${stats.cards} tanult kártya, ${stats.reviews} válasz, ${stats.sessions} Aréna-kör, ${stats.errors} hiba.` : "–"}
            </p>
            <p className="desc">
              {stats?.lastExport ? `Utolsó mentés: ${new Date(stats.lastExport).toLocaleDateString("hu-HU", { year: "numeric", month: "long", day: "numeric" })}.` : "Még nincs mentés."}
            </p>
          </div>
          <div className="well">
            <div className="row">
              <span className="grow">
                <span className="title" style={{ display: "block" }}>Exportálás</span>
                <span className="line2">JSON-fájl a haladással, a hibákkal és a beállításokkal</span>
              </span>
              <button className="btn" onClick={() => void doExport()}><IconDownload />Exportálás</button>
            </div>
            <div className="row" style={{ flexWrap: "wrap" }}>
              <span className="grow">
                <span className="title" style={{ display: "block" }}>Importálás</span>
                <span className="line2">Az eszköz minden adatát lecseréli a fájlban lévőkre</span>
              </span>
              <button className="btn" onClick={() => fileRef.current?.click()}><IconUpload />Fájl kiválasztása</button>
              <input ref={fileRef} type="file" accept="application/json,.json" hidden onChange={(e) => void pick(e.target.files?.[0])} />
            </div>
            {error && <p className="notice" role="alert" style={{ margin: "0 0 14px" }}>{error}</p>}
            {pending && (
              <div className="confirm" role="alertdialog" aria-label="Importálás megerősítése">
                <p>
                  <strong style={{ fontWeight: 500 }}>{pending.name}</strong>: {pending.counts.srs ?? 0} kártya, {pending.counts.sessions ?? 0} kör, {pending.counts.errors ?? 0} hiba.
                  A jelenlegi adatok helyükre kerülnek.
                </p>
                <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
                  <button className="btn danger" onClick={() => void confirmImport()}>Adatok cseréje</button>
                  <button className="btn ghost" onClick={() => setPending(null)}>Mégse</button>
                </div>
              </div>
            )}
          </div>
        </section>

        <section className="setting">
          <div>
            <h2>Tartalom</h2>
            <p className="desc">Az új leckék és feladatok maguktól megérkeznek, amikor újra megnyitod az alkalmazást. Ha régi a verzió, zárd be teljesen, és nyisd meg újra.</p>
          </div>
          <div className="well">
            <div className="row"><span className="grow">Leckék</span><span className="end num">{lessons.length}</span></div>
            <div className="row"><span className="grow">Kártyák a leckékből</span><span className="end num">{cards.length}</span></div>
            <div className="row"><span className="grow">Aréna-témakörök</span><span className="end num">{arenaTopics.length}</span></div>
            <div className="row"><span className="grow">Feladatok</span><span className="end num">{arenaTopics.reduce((n, t) => n + t.exercises.length, 0)}</span></div>
            <div className="row"><span className="grow">Verzió</span><span className="end num">{BUILD_LABEL}</span></div>
            <div className="row">
              <span className="grow">Az alkalmazás visszaállítása<span className="muted" style={{ display: "block", fontSize: "var(--fs-small)" }}>Újra letölti az alkalmazást, ha régi maradt. A haladásod megmarad.</span></span>
              <button className="btn secondary" onClick={() => window.__arenaReset?.()}>Visszaállítás</button>
            </div>
          </div>
        </section>
      </div>
      {toast && <div className="toast" role="status">{toast}</div>}
    </>
  );
}
