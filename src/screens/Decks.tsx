import { useLiveQuery } from "dexie-react-hooks";
import { deckName } from "../content.ts";
import { useAllCards, useNow, useSettings } from "../data.ts";
import { db } from "../db/instance.ts";
import { loadStates, newIntroducedToday } from "../db/repo.ts";
import { addDays, dayKey } from "../lib/srs.ts";
import { href } from "../router.ts";
import { PhoneBrand } from "../ui/Mark.tsx";

const WEEKDAY = new Intl.DateTimeFormat("hu-HU", { weekday: "short" });

export function Decks() {
  const cards = useAllCards();
  const settings = useSettings();
  const now = useNow();
  const states = useLiveQuery(() => loadStates(db), [], new Map());
  const introduced = useLiveQuery(() => newIntroducedToday(db, now), [now], 0);
  const newLeft = Math.max(0, settings.newPerDay - introduced);
  const upcoming = cards.filter((c) => { const st = states.get(c.id); return !st || st.phase === "new"; }).slice(0, newLeft);

  const tags = [...new Set(cards.map((c) => c.tag))];
  const endToday = addDays(now, 1);
  const decks = tags.map((tag) => {
    const list = cards.filter((c) => c.tag === tag);
    let due = 0, unseen = 0, learned = 0;
    for (const c of list) {
      const s = states.get(c.id);
      if (!s || s.phase === "new") unseen++;
      else {
        if (s.due < endToday) due++;
        if (s.phase === "review") learned++;
      }
    }
    return { tag, total: list.length, due, unseen, learned };
  });

  // Ripassi in arrivo: oggi + 6 giorni (solo direzione HU→IT e IT→HU già iniziate)
  const days = Array.from({ length: 7 }, (_, i) => addDays(now, i));
  const forecast = days.map((d, i) => {
    const end = addDays(d, 1);
    let n = 0;
    for (const s of states.values()) if (s.phase !== "new" && (i === 0 ? s.due < end : s.due >= d && s.due < end)) n++;
    if (i === 0) n += upcoming.length;
    return { key: dayKey(d), label: i === 0 ? "Ma" : WEEKDAY.format(d), n };
  });
  const totalDue = decks.reduce((a, d) => a + d.due, 0);
  const max = Math.max(4, ...forecast.map((f) => f.n));
  const step = max <= 8 ? 2 : max <= 20 ? 5 : 10;
  const top = Math.ceil((max + 1) / step) * step;
  const ticks = Array.from({ length: top / step + 1 }, (_, i) => i * step);

  return (
    <>
      <div className="title-row">
        <div>
          <PhoneBrand />
          <h1>Kártyák</h1>
          <p className="sub">
            {cards.length} kártya, {decks.length} pakli · napi {settings.newPerDay} új
            {settings.reverse ? " · olasz → magyar irányban is" : ""}
          </p>
        </div>
        <div className="actions">
          <a className="btn primary" href={href("kartyak", "tanulas", "osszes")}>Minden pakli tanulása</a>
        </div>
      </div>

      <div className="grid stretch">
        <section className="panel span-8 col">
          <header><h2>Paklik</h2><span className="meta">Mai ismétlés</span></header>
          <ul className="rows">
            {decks.map((d) => (
              <li key={d.tag}>
                <a className="row" href={href("kartyak", "tanulas", d.tag)}>
                  <span className="grow">
                    <span className="title" style={{ display: "block" }}>{deckName(d.tag)}</span>
                    <span className="line2 num">{d.total} kártya · {d.learned} ismétlésben · {d.unseen} még nem látott</span>
                  </span>
                  <span className="end num" style={{ fontSize: 18 }}>{d.due}</span>
                </a>
              </li>
            ))}
          </ul>
          <p className="total num"><span>{cards.length} kártya</span><span>{totalDue}</span></p>
        </section>

        <section className="panel span-4">
          <header><h2>A következő napok</h2><span className="meta">Kártyák</span></header>
          <figure className="forecast" aria-label={`Ismétlések: ${forecast.map((f) => `${f.label} ${f.n}`).join(", ")}`}>
            <div className="forecast-plot">
              {ticks.map((t) => (
                <span key={t} className="tick" style={{ bottom: `${(t / top) * 100}%` }}><span>{t}</span></span>
              ))}
              <div className="bars">
                {forecast.map((f, i) => (
                  <span key={f.key} className={`bar${i === 0 ? " today" : ""}`} style={{ height: `${(f.n / top) * 100}%` }} title={`${f.label}: ${f.n}`} />
                ))}
              </div>
            </div>
            <div className="forecast-x">
              {forecast.map((f) => <span key={f.key}>{f.label}</span>)}
            </div>
          </figure>
          <p className="caption">Ma: ismétlések és {upcoming.length} új kártya. A többi napon csak a már betervezett ismétlések.</p>
        </section>

        <section className="panel span-12">
          <header>
            <h2>Mai új kártyák</h2>
            <span className="meta">{upcoming.length ? `${upcoming.length} kártya: ${[...new Set(upcoming.map((u) => deckName(u.tag)))].join(", ")}` : "Napi cél teljesítve"}</span>
          </header>
          {upcoming.length ? (
            <ul className="word-grid">
              {upcoming.map((c) => (
                <li key={c.id}><span className="truncate" lang="hu">{c.hu}</span>{new Set(upcoming.map((u) => u.tag)).size > 1 && <span className="muted truncate" style={{ fontSize: "var(--fs-small)" }}>{deckName(c.tag)}</span>}</li>
              ))}
            </ul>
          ) : (
            <p className="empty">A mai cél teljesítve. Ha van időd, a „Minden pakli tanulása” további új kártyákat vagy előre ismétlést ad.</p>
          )}
        </section>
      </div>
    </>
  );
}
