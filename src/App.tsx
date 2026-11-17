import type { ReactNode } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { useAllCards, useNow, useSettings, useTheme } from "./data.ts";
import { db } from "./db/instance.ts";
import { homeSummary } from "./db/repo.ts";
import { href, useRoute } from "./router.ts";
import { Home } from "./screens/Home.tsx";
import { Decks } from "./screens/Decks.tsx";
import { Review } from "./screens/Review.tsx";
import { ArenaList } from "./screens/ArenaList.tsx";
import { ArenaSession } from "./screens/ArenaSession.tsx";
import { LessonScreen, LessonList } from "./screens/Lessons.tsx";
import { Errors } from "./screens/Errors.tsx";
import { SettingsScreen } from "./screens/Settings.tsx";
import { IconArena, IconAssimil, IconCards, IconErrors, IconSettings, IconToday } from "./ui/icons.tsx";
import { Mark } from "./ui/Mark.tsx";
import { ErrorBoundary } from "./ui/ErrorBoundary.tsx";

const NAV = [
  { id: "", label: "Ma", icon: <IconToday /> },
  { id: "kartyak", label: "Kártyák", icon: <IconCards /> },
  { id: "arena", label: "Aréna", icon: <IconArena /> },
  { id: "leckek", label: "Leckék", icon: <IconAssimil /> },
  { id: "hibak", label: "Hibák", icon: <IconErrors /> },
  { id: "beallitasok", label: "Beállítások", short: "Beállítás", icon: <IconSettings /> },
] as const;

export function App() {
  const settings = useSettings();
  useTheme(settings.theme);
  const [section = "", sub, arg] = useRoute();

  // Sessioni a schermo pieno, senza navigazione
  const key = [section, sub, arg].join("/");
  if (section === "kartyak" && sub === "tanulas") return <ErrorBoundary resetKey={key}><Review deck={arg ?? "osszes"} /></ErrorBoundary>;
  if (section === "arena" && sub) return <ErrorBoundary resetKey={key}><ArenaSession topic={sub} /></ErrorBoundary>;

  let screen: ReactNode;
  switch (section) {
    case "kartyak": screen = <Decks />; break;
    case "arena": screen = <ArenaList />; break;
    case "leckek": screen = arg ? <LessonScreen tab={sub} id={arg} /> : <LessonList tab={sub} />; break;
    case "hibak": screen = <Errors />; break;
    case "beallitasok": screen = <SettingsScreen />; break;
    default: screen = <Home />;
  }
  return <Shell current={section}><ErrorBoundary resetKey={key}>{screen}</ErrorBoundary></Shell>;
}

function Shell({ current, children }: { current: string; children: ReactNode }) {
  const cards = useAllCards();
  const now = useNow();
  const summary = useLiveQuery(() => homeSummary(db, cards, now), [cards, now]);
  const dueBadge = summary ? summary.dueToday : 0;

  return (
    <div className="app">
      <nav className="sidebar" aria-label="Fő navigáció">
        <a className="brand" href={href()}>
          <Mark />
          <span>
            <span className="brand-name" style={{ display: "block" }}>Olaszóra</span>
            <span className="brand-scope">Olasz · A1–A2</span>
          </span>
        </a>
        {NAV.slice(0, 5).map((n) => (
          <a key={n.id} className="nav-item" href={href(...(n.id ? [n.id] : []))} aria-current={current === n.id ? "page" : undefined}>
            {n.icon}
            {n.label}
            {n.id === "kartyak" && dueBadge > 0 && <span className="count num" aria-label={`${dueBadge} ismétlendő`}>{dueBadge}</span>}
          </a>
        ))}
        <div className="bottom">
          <a className="nav-item" href={href("beallitasok")} aria-current={current === "beallitasok" ? "page" : undefined}>
            <IconSettings />
            Beállítások
          </a>
        </div>
      </nav>
      <main className="canvas">
        <div className="column">{children}</div>
      </main>
      <nav className="tabbar" aria-label="Fő navigáció">
        {NAV.map((n) => (
          <a key={n.id} href={href(...(n.id ? [n.id] : []))} aria-current={current === n.id ? "page" : undefined}>
            {n.icon}
            <span>{"short" in n ? n.short : n.label}</span>
          </a>
        ))}
      </nav>
    </div>
  );
}
