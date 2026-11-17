import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { registerSW } from "virtual:pwa-register";
import "./styles/app.css";
import { App } from "./App.tsx";
import { ErrorBoundary } from "./ui/ErrorBoundary.tsx";
import { db, requestPersistence } from "./db/instance.ts";
import { migrateOnStart } from "./db/migrate.ts";

// L'app installata sul telefono spesso non riparte da zero: torna dallo sfondo.
// Per vedere subito gli esercizi nuovi controlla gli aggiornamenti ogni volta che torna visibile
// (e ogni 30 minuti). Con autoUpdate la nuova versione si installa e la pagina si ricarica da sola.
registerSW({
  immediate: true,
  onRegisteredSW(_url, reg) {
    if (!reg) return;
    const check = () => { if (navigator.onLine) void reg.update().catch(() => {}); };
    document.addEventListener("visibilitychange", () => { if (document.visibilityState === "visible") check(); });
    setInterval(check, 30 * 60_000);
  },
});
void requestPersistence();
// Progressi della vecchia Olaszóra (una volta sola). La parte sincrona (leggere e togliere #/atvetel/…)
// avviene prima del primo render, così il router non vede l'indirizzo con i dati.
void migrateOnStart(db).catch((e) => console.error("Migrazione dei vecchi progressi non riuscita", e));

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>,
);
