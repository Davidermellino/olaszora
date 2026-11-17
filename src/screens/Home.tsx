import { useLiveQuery } from "dexie-react-hooks";
import { topicRows } from "../content.ts";
import { lessons } from "../lessons.ts";
import { useAllCards, useNow } from "../data.ts";
import { db } from "../db/instance.ts";
import { bestLocalScores, doneToday, homeSummary, lessonsDone, recentErrors } from "../db/repo.ts";
import type { ImportSummary } from "../db/migrate.ts";
import { checkAnswer } from "../lib/checker.ts";
import { href } from "../router.ts";
import { GradeDot, Marked, plural, relativeDay, todayLabel, TYPE_LABEL } from "../ui/bits.tsx";
import { PhoneBrand } from "../ui/Mark.tsx";
import { fmtScore, nextTopic } from "./arenaUtil.ts";

export function Home() {
  const cards = useAllCards();
  const now = useNow();
  const data = useLiveQuery(async () => {
    const [summary, done, best, errors, learned, finished, notice] = await Promise.all([
      homeSummary(db, cards, now),
      doneToday(db, now),
      bestLocalScores(db),
      recentErrors(db, 4, false),
      db.srs.where("phase").equals("review").count(),
      lessonsDone(db),
      db.settings.get("legacyNotice"),
    ]);
    return { summary, done, best, errors, learned, finished, notice: notice?.value as ImportSummary | undefined };
  }, [cards, now]);

  const rows = topicRows(data?.best ?? new Map());
  const next = nextTopic(rows);
  const nextLesson = lessons.find((l) => !data?.finished.includes(l.id));
  const todo = data ? data.summary.dueToday + data.summary.newLeft : 0;
  const total = data ? data.done + todo : 0;

  let finding = "";
  if (data) {
    if (todo === 0 && data.done > 0) finding = `Napi cél teljesítve: ma ${plural(data.done, "kártya", "kártya")}.`;
    else if (todo === 0) finding = "Ma nincs teendő kártya.";
    else finding = `${plural(data.summary.dueToday, "ismétlés", "ismétlés")} és ${plural(data.summary.newLeft, "új kártya", "új kártya")} vár rád.`;
  }

  return (
    <>
      <div className="title-row">
        <div>
          <PhoneBrand />
          <h1>Ma</h1>
          <p className="sub">
            {todayLabel(now).replace(/^./, (c) => c.toUpperCase())} · {finding}
          </p>
        </div>
        <div className="actions">
          {todo > 0 ? (
            <a className="btn primary" href={href("kartyak", "tanulas", "osszes")}>{plural(todo, "kártya", "kártya")} átnézése</a>
          ) : (
            <a className="btn secondary" href={href("kartyak", "tanulas", "osszes")}>Tanulás folytatása</a>
          )}
        </div>
      </div>

      {data?.notice && (
        <div className="notice" role="status" style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap", marginBottom: "var(--gap)" }}>
          <span className="grow">
            Átvettük a korábbi Olaszóra haladásodat: {plural(data.notice.cards, "kártya", "kártya")}, {plural(data.notice.lessons, "kész lecke", "kész lecke")}, {plural(data.notice.days, "tanulási nap", "tanulási nap")}.
          </span>
          <button className="btn secondary" onClick={() => void db.settings.delete("legacyNotice")}>Rendben</button>
        </div>
      )}

      <div className="grid stretch">
        <section className="panel span-8 col">
          <header>
            <h2>Mai kártyák</h2>
            <a className="card-link" href={href("kartyak")}>Paklik</a>
          </header>
          <p className="lead-figure">
            {data ? todo : "–"}
            <small>teendő</small>
          </p>
          <div className="plan" role="img" aria-label={`${total} kártyából ${data?.done ?? 0} kész`}>
            {total > 0 && (
              <>
                <span className="done" style={{ width: `${((data?.done ?? 0) / total) * 100}%` }} />
                <span className="due" style={{ width: `${(todo / total) * 100}%` }} />
              </>
            )}
          </div>
          <p className="plan-legend num">
            <span><i style={{ background: "var(--hue)" }} />Kész {data?.done ?? 0}</span>
            <span><i style={{ background: "var(--text)", opacity: 0.25 }} />Ismétlés {data?.summary.dueToday ?? 0}</span>
            <span><i style={{ background: "var(--text)", opacity: 0.25 }} />Új {data?.summary.newLeft ?? 0}</span>
          </p>
          <div className="kpis">
            <div className="kpi">
              <p className="kpi-label">Sorozat</p>
              <p className="kpi-value">{data?.summary.streak ?? 0}<small>nap</small></p>
            </div>
            <div className="kpi">
              <p className="kpi-label">Ismétlésben</p>
              <p className="kpi-value">{data?.learned ?? 0}<small>kártya</small></p>
            </div>
            <div className="kpi">
              <p className="kpi-label">A pakliban</p>
              <p className="kpi-value">{cards.length}<small>kártya</small></p>
            </div>
          </div>
        </section>

        <section className="panel span-4 col">
          <header>
            <h2>Következő az Arénában</h2>
            <a className="card-link" href={href("arena")}>Mind</a>
          </header>
          {next ? (
            <>
              <p className="line1" style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <span className="lead-figure" style={{ fontSize: 22, lineHeight: "28px" }}>{next.id}</span>
                <span className={next.status === "conquistato" ? "pill pos" : "pill"}>{next.status === "conquistato" ? "Megszerezve" : next.status === "in coda" ? "Sorban" : "Új"}</span>
              </p>
              <p style={{ marginTop: 2 }}>{next.title}</p>
              <dl className="facts">
                <div><dt>Legjobb BOSS</dt><dd className="num">{fmtScore(next.best)}</dd></div>
                <div><dt>Feladatok</dt><dd className="num">{next.exercises}</dd></div>
              </dl>
              <a className="btn secondary block foot" href={href("arena", next.id)}>{next.id} gyakorlása · 10 feladat</a>
            </>
          ) : (
            <p className="empty">Még nincs témakör feladatokkal.</p>
          )}
        </section>

        <section className="panel span-6">
          <header>
            <h2>Következő lecke</h2>
            <a className="card-link" href={href("leckek")}>Mind {lessons.length}</a>
          </header>
          {nextLesson ? (
            <ul className="rows">
              <li>
                <a className="row" href={href("leckek", nextLesson.review ? "nyelvtan" : "dialogusok", nextLesson.id)}>
                  <span className="topic-id">{nextLesson.id}</span>
                  <span className="grow">
                    <span className="title truncate" style={{ display: "block" }} lang="it">{nextLesson.titleIt}</span>
                    <span className="line2 truncate">{nextLesson.titleHu}</span>
                  </span>
                  <span className="end num muted">{data ? `${data.finished.length}/${lessons.length} kész` : ""}</span>
                </a>
              </li>
            </ul>
          ) : (
            <p className="empty">Minden lecke kész. Bravo!</p>
          )}
        </section>

        <section className="panel span-6">
          <header>
            <h2>Legutóbbi hibák</h2>
            <a className="card-link" href={href("hibak")}>Mind</a>
          </header>
          {data && data.errors.length === 0 ? (
            <p className="empty">Még nincs hiba. Az Aréna gyakorlatai után itt jelennek meg.</p>
          ) : (
            <ul className="rows">
              {(data?.errors ?? []).map((e) => {
                const acc = e.grade === "minor" ? checkAnswer(e.given, [e.expected]).accent : undefined;
                return (
                  <li key={e.id} className="row">
                    <GradeDot grade={e.grade} />
                    <span className="grow">
                      <span className="line1 truncate">
                        {acc ? <Marked text={acc.given} positions={acc.positions} /> : <span className="diff" style={{ textDecoration: "line-through", textDecorationColor: "var(--negative)" }}>{e.given || "(üres)"}</span>}
                        <span className="muted">→</span>
                        <span className="diff" style={{ fontWeight: 500 }}>{e.expected}</span>
                      </span>
                      <span className="line2">{e.topic} · {TYPE_LABEL[e.type]} · {relativeDay(e.date, now)}</span>
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      </div>
    </>
  );
}
