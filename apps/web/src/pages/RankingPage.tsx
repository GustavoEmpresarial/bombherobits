import { useEffect, useState } from "react";
import { PageHeading, PageState } from "../components/Page";
import { api } from "../lib/api";
import { useAuth } from "../state/AuthContext";
import type { SummonRanking } from "./types";
import "./ranking.css";

const format = (date: string) => new Date(date).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });

export function RankingPage() {
  const { token } = useAuth();
  const [ranking, setRanking] = useState<SummonRanking | null>(null);
  const [error, setError] = useState("");
  useEffect(() => {
    if (!token) return;
    let active = true;
    void api.summonRanking(token).then(data => { if (active) setRanking(data); }).catch(cause => {
      if (active) setError(cause instanceof Error ? cause.message : "Could not load ranking");
    });
    return () => { active = false; };
  }, [token]);
  if (!ranking) return <PageState error={error} retry={() => window.location.reload()} />;
  return <section className="page ranking-page" aria-label="SUMMON RANKING">
    <PageHeading eyebrow="SEASON STANDINGS" title="Every summon counts." description="Summon heroes to score points. Rarer cards are worth more, and the board resets each seven-day season." />
    <div className="ranking-season page-panel">
      <div><small>SEASON {ranking.season}</small><strong>{format(ranking.startsAt)} — {format(ranking.endsAt)}</strong></div>
      <div><small>YOUR POSITION</small><strong>{ranking.me ? `#${ranking.me.rank} · ${ranking.me.points.toLocaleString("en-US")} pts` : "Not ranked yet"}</strong></div>
    </div>
    <div className="ranking-table page-panel">
      <div className="ranking-row ranking-head"><span>RANK</span><span>ADVENTURER</span><span>SUMMONS</span><span>POINTS</span></div>
      {ranking.standings.map(row => <div className={`ranking-row${row.userId === ranking.me?.userId ? " ranking-me" : ""}`} key={row.userId}>
        <strong>#{row.rank}</strong><span>{row.displayName}</span><span>{row.summons}</span><strong>{row.points.toLocaleString("en-US")}</strong>
      </div>)}
      {!ranking.standings.length && <div className="ranking-empty"><strong>The board is waiting.</strong><p>Be the first to summon a hero this season.</p></div>}
    </div>
    <p className="ranking-note">Common 1 · Rare 3 · Super Rare 8 · Epic 20 · Legendary 60 · Super Legend 180 points. Demo and live standings are separate.</p>
  </section>;
}
