import { useLiveQuery } from "dexie-react-hooks";
import { arenaTopics, topicRows } from "../content.ts";
import { useNow } from "../data.ts";
import { db } from "../db/instance.ts";
import { bestLocalScores, recentSessions } from "../db/repo.ts";
import { href } from "../router.ts";
import { plural, relativeDay } from "../ui/bits.tsx";
import { PhoneBrand } from "../ui/Mark.tsx";
import { fmtScore } from "./arenaUtil.ts";

const STATUS: Record<string, { label: string; cls: string }> = {
  conquistato: { label: "Megszerezve", cls: "pill pos" },
  "in coda": { label: "Sorban", cls: "pill" },
  nuovo: { label: "Új", cls: "pill" },
};

export function ArenaList() {
  const now = useNow();
  const data = useLiveQuery(async () => ({
    best: await bestLocalScores(db),
    sessions: await recentSessions(db, 6),
  }), []);
  const rows = topicRows(data?.best ?? new Map());
  const played = rows.filter((r) => r.best !== null).length;

  return (
    <>
      <div className="title-row">
        <div>
          <PhoneBrand />
          <h1>Aréna</h1>
          <p className="sub">
            {plural(rows.length, "témakör", "témakör")} · ebből {played} gyakorolva · 10 kérdés egy körben
          </p>
        </div>
        <div className="actions">
          <a className="btn secondary" href={href("arena", "torna")} aria-disabled={arenaTopics.length < 2}>Vegyes torna</a>
        </div>
      </div>

      <div className="grid">
        <section className="panel span-8">
          <header><h2>Témakörök</h2><span className="meta">Legjobb BOSS</span></header>
          <ul className="rows">
            {rows.map((r) => {
              const st = STATUS[r.status]!;
              const body = (
                <>
                  <span className="topic-id">{r.id}</span>
                  <span className="grow">
                    <span className="line1">
                      <span className="title truncate">{r.title}</span>
                    </span>
                    <span className="line2">{r.exercises} feladat</span>
                  </span>
                  <span className={st.cls}>{st.label}</span>
                  <span className="end num" style={{ width: 52 }}>{fmtScore(r.best)}</span>
                </>
              );
              return <li key={r.id}><a className="row" href={href("arena", r.id)}>{body}</a></li>;
            })}
          </ul>
        </section>

        <div className="span-4 stack">
        <section className="panel">
          <header><h2>Pontozás</h2></header>
          <div className="scorebook">
            <div><span className="dot pos" />Helyes<span className="pts">2 pont</span></div>
            <div><span className="dot warn" />Csak az ékezet hibás<span className="pts">1 pont</span></div>
            <div><span className="dot neg" />Hibás<span className="pts">0 pont</span></div>
          </div>
          <p className="caption">10 kérdés, az eredmény 10 pontos skálán: 8 vagy több = megszerezve. Feleletválasztós kérdésnél nincs ékezethiba. A „Jó volt” gombbal kézzel javíthatsz egy elfogadható választ.</p>
        </section>
        <section className="panel">
          <header><h2>Legutóbbi körök</h2></header>
          {data && data.sessions.length === 0 ? (
            <p className="empty">Még nincs kör. Válassz egy témakört a kezdéshez.</p>
          ) : (
            <ul className="rows">
              {(data?.sessions ?? []).slice(0, 4).map((s) => (
                <li key={s.id} className="row">
                  <span className="grow">
                    <span className="title" style={{ display: "block" }}>{s.topics.length > 1 ? "Torna" : s.topics[0]}</span>
                    <span className="line2">{relativeDay(s.date, now)} · {plural(s.results.length, "kérdés", "kérdés")}</span>
                  </span>
                  <span className="end num">{fmtScore(s.max ? (s.points / s.max) * 10 : null)}</span>
                </li>
              ))}
            </ul>
          )}
        </section>
        </div>
      </div>
    </>
  );
}
