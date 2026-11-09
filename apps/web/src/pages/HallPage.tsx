import { useEffect, useMemo, useState, type CSSProperties } from "react";
import { RARITY_INFO, type HallStateDto, type HeroDto, type HeroRarity } from "@herobits/shared";
import { GameSprite } from "../components/GameSprite";
import { PageHeading, PageState } from "../components/Page";
import { HERO_ART } from "../lib/characters";
import { api } from "../lib/api";
import { useAuth } from "../state/AuthContext";
import "./hall.css";

const RARITIES: HeroRarity[] = ["COMMON", "RARE", "SUPER_RARE", "EPIC", "LEGENDARY", "SUPER_LEGENDARY"];
const format = (number: number) => number.toLocaleString("en-US");

export function HallPage() {
  const { token, setUser } = useAuth();
  const [state, setState] = useState<HallStateDto | null>(null);
  const [heroes, setHeroes] = useState<HeroDto[]>([]);
  const [tab, setTab] = useState<"GLORY" | "RETIRE">("GLORY");
  const [rarity, setRarity] = useState<HeroRarity>("COMMON");
  const [picked, setPicked] = useState<string[]>([]);
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  useEffect(() => {
    if (!token) return;
    let active = true;
    void Promise.all([api.hall(token), api.heroes(token)]).then(([hall, roster]) => { if (active) { setState(hall); setHeroes(roster); } }).catch(cause => { if (active) setError(cause instanceof Error ? cause.message : "Could not load the Hall"); });
    return () => { active = false; };
  }, [token]);

  const eligible = useMemo(() => heroes.filter(hero => !hero.active && hero.status === "IDLE" && hero.rarity === rarity).sort((a, b) => a.atk - b.atk || a.id.localeCompare(b.id)), [heroes, rarity]);
  const next = state?.milestones.find(item => !item.claimed);
  const earned = (state?.gloryByRarity[rarity] ?? 0) * picked.length;

  async function update(action: () => Promise<HallStateDto>, message: string) {
    if (!token || busy) return;
    setBusy(true); setError(""); setNotice("");
    try {
      setState(await action());
      setHeroes(await api.heroes(token));
      setUser(await api.me(token));
      setPicked([]); setConfirm(false); setNotice(message);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Could not update the Hall"); }
    finally { setBusy(false); }
  }

  if (!token || !state) return <PageState error={error} retry={() => window.location.reload()} />;
  return <section className="page hall-page" aria-label="HALL OF HEROES">
    <PageHeading eyebrow="HEROES · THE HALL" title="Every legend leaves a mark." description="Retire inactive heroes for seasonal Glory. Claim rewards along the road and climb the rankings." />
    <div className="hall-tabs" role="tablist" aria-label="Hall of Heroes"><button type="button" role="tab" aria-selected={tab === "GLORY"} onClick={() => setTab("GLORY")}>GLORY</button><button type="button" role="tab" aria-selected={tab === "RETIRE"} onClick={() => setTab("RETIRE")}>RETIRE</button></div>
    {error && <p className="error-line" role="alert">{error}</p>}{notice && <p className="equipment-notice" role="status">{notice}</p>}
    {tab === "GLORY" ? <div className="hall-layout"><div className="hall-road page-panel"><div className="hall-glory"><div><small>YOUR GLORY · SEASON {state.season}</small><strong>{format(state.glory)}</strong><span>{state.retired} HEROES RETIRED</span></div><div><b>{state.multiplier}X GLORY {state.multiplier > 1 ? "EVENT" : "RATE"}</b><small>SEASON ENDS {new Date(state.endsAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })}</small></div></div><div className="hall-next"><small>NEXT PRIZE</small><strong>{next?.label ?? "Road complete"}</strong><span>{next ? `${format(Math.max(0, next.points - state.glory))} glory to go` : "All current prizes claimed"}</span></div><div className="hall-milestones">{state.milestones.map(item => <div className={`hall-milestone${item.unlocked ? " unlocked" : ""}`} key={item.points}><span>{format(item.points)}</span><strong>{item.label}</strong>{item.claimed ? <em>CLAIMED</em> : item.unlocked ? <button type="button" disabled={busy} onClick={() => void update(() => api.claimHall(token, item.points), `${item.label} claimed.`)}>CLAIM</button> : <small>LOCKED</small>}</div>)}</div><section className="hall-races"><small>FIRST TO REACH</small>{state.races.map(race => <div key={race.points}><span><strong>{format(race.points)} GLORY · {race.label}</strong><small>{race.left} OF {race.seats} SEATS LEFT</small></span>{race.claimed ? <em>CLAIMED</em> : <button type="button" disabled={busy || !race.unlocked || !race.left} onClick={() => void update(() => api.claimHallRace(token, race.points), `${race.label} race prize claimed.`)}>{race.left ? race.unlocked ? "CLAIM" : "LOCKED" : "FULL"}</button>}</div>)}</section><p className="hall-note">Each season lasts 14 days. Glory, the road and rankings restart when the next season begins. Retirement cannot be reversed.</p></div><aside className="hall-ranking page-panel"><small>SEASON {state.season}</small><h2>GLORY RANKING</h2><p>YOUR PLACE <strong>{state.me ? `#${state.me.rank}` : "—"}</strong> · {format(state.glory)} GLORY</p>{state.standings.slice(0, 100).map(row => <div className="hall-rank-row" key={row.userId}><b>#{row.rank}</b><span>{row.displayName}</span><strong>{format(row.glory)}</strong></div>)}{!state.standings.length && <p>No retirees yet. The Hall is waiting.</p>}<small>Top 100 are ranked for the season. Prize distribution is announced separately.</small></aside></div> : <div className="hall-retire-layout"><div className="hall-retire-roster page-panel"><small>RARITY TO RETIRE</small><div className="hall-rarities">{RARITIES.map(value => <button key={value} type="button" aria-pressed={rarity === value} style={{ "--rarity": RARITY_INFO[value].color } as CSSProperties} onClick={() => { setRarity(value); setPicked([]); setConfirm(false); }}>{RARITY_INFO[value].name}<small>{heroes.filter(hero => !hero.active && hero.status === "IDLE" && hero.rarity === value).length}</small></button>)}</div><div className="hall-pick-actions"><span>{picked.length} OF {eligible.length} PICKED</span><button type="button" disabled={!eligible.some(hero => !picked.includes(hero.id)) || picked.length >= 15} onClick={() => { const next = eligible.find(hero => !picked.includes(hero.id)); if (next) setPicked(ids => [...ids, next.id]); setConfirm(false); }}>SELECT WEAKEST</button><button type="button" disabled={!picked.length} onClick={() => { setPicked([]); setConfirm(false); }}>CLEAR</button></div><div className="hall-heroes">{eligible.map(hero => <button type="button" key={hero.id} className={picked.includes(hero.id) ? "picked" : ""} aria-pressed={picked.includes(hero.id)} onClick={() => { setPicked(ids => ids.includes(hero.id) ? ids.filter(id => id !== hero.id) : ids.length < 15 ? [...ids, hero.id] : ids); setConfirm(false); }}><GameSprite kind={HERO_ART[hero.class].id} scale={1.5} /><span><strong>{HERO_ART[hero.class].name}</strong><small>#{hero.id.slice(-5)} · ATK {hero.atk} · DUR {hero.stamina}/{hero.maxStamina}</small></span><b>{format(state.gloryByRarity[rarity])} GLORY</b></button>)}{!eligible.length && <p className="team-empty">No inactive {RARITY_INFO[rarity].name} heroes. Deactivate a resting hero on the Team page first.</p>}</div></div><aside className="hall-retire-summary page-panel"><small>RETIRE</small><h2>{picked.length} {picked.length === 1 ? "HERO" : "HEROES"}</h2><div>YOUR GLORY <strong>{format(state.glory)} → {format(state.glory + earned)}</strong></div><div>EACH HERO <strong>{format(state.gloryByRarity[rarity])}</strong></div><p>Retired heroes leave your account permanently. They give Glory, not Scrap. Remove their gear first.</p>{confirm ? <div className="hall-confirm"><button type="button" disabled={busy} onClick={() => void update(() => api.retireHeroes(token, picked, crypto.randomUUID()), `${picked.length} heroes retired for ${format(earned)} Glory.`)}>CONFIRM PERMANENT RETIREMENT</button><button type="button" onClick={() => setConfirm(false)}>CANCEL</button></div> : <button type="button" disabled={busy || !picked.length} onClick={() => setConfirm(true)}>RETIRE · +{format(earned)} GLORY</button>}</aside></div>}
  </section>;
}
