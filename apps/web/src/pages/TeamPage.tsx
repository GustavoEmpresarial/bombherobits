import { useEffect, useMemo, useState, type CSSProperties } from "react";
import { Link } from "react-router-dom";
import { RARITY_INFO, SKILL_LABELS, type HeroDto } from "@herobits/shared";
import { GameSprite } from "../components/GameSprite";
import { PageHeading, PageState } from "../components/Page";
import { HERO_ART } from "../lib/characters";
import { api } from "../lib/api";
import { useAuth } from "../state/AuthContext";
import "./team.css";

type Filter = "ALL" | "WORKING" | "RESTING";
const pct = (value: number, maximum: number) => `${Math.max(0, Math.min(100, Math.round(value / Math.max(1, maximum) * 100)))}%`;

export function TeamPage() {
  const { token } = useAuth();
  const [heroes, setHeroes] = useState<HeroDto[] | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [filter, setFilter] = useState<Filter>("ALL");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  useEffect(() => {
    if (!token) return;
    let active = true;
    void api.heroes(token).then((rows) => { if (active) setHeroes(rows); }).catch((cause) => { if (active) setError(cause instanceof Error ? cause.message : "Could not load team"); });
    return () => { active = false; };
  }, [token]);

  const selected = heroes?.find((hero) => hero.id === selectedId) ?? heroes?.[0];
  const working = heroes?.filter((hero) => hero.status === "HUNTING") ?? [];
  const visible = useMemo(() => (heroes ?? []).filter((hero) => filter === "ALL" || (filter === "WORKING" ? hero.status === "HUNTING" : hero.status === "IDLE")), [heroes, filter]);

  async function act(action: () => Promise<unknown>, success: string) {
    if (!token || busy) return;
    setBusy(true); setError(""); setNotice("");
    try { await action(); setHeroes(await api.heroes(token)); setNotice(success); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "Could not update the team"); }
    finally { setBusy(false); }
  }
  async function deploy(body: { heroId?: string; all?: boolean }) {
    if (!token) return;
    await api.startDungeon(token);
    await api.deploy(token, body);
  }

  if (!token || !heroes) return <PageState error={error} retry={() => window.location.reload()} />;
  return <section className="page team-page" aria-label="HEROES TEAM">
    <PageHeading eyebrow="YOUR HEROES" title="Build your team." description="Choose who hunts and who rests. Watch weapon durability and shields before sending a hero back to the dungeon." />
    <div className="team-summary page-panel"><strong>{working.length}<span> / 15 WORKING</span></strong><span>{heroes.length} OWNED · {heroes.filter((hero) => hero.status === "IDLE").length} RESTING</span><div><button type="button" disabled={busy || !heroes.some((hero) => hero.status === "IDLE" && hero.stamina > 0 && hero.shield > 0)} onClick={() => void act(() => deploy({ all: true }), "Available heroes sent to work.")}>WORK ALL</button><button type="button" disabled={busy || !working.length} onClick={() => void act(async () => { for (const hero of working) await api.restHero(token, hero.id); }, "Working heroes are resting.")}>REST ALL</button></div></div>
    {error && <p className="error-line" role="alert">{error}</p>}{notice && <p className="equipment-notice" role="status">{notice}</p>}
    <div className="team-layout">
      <div className="team-roster page-panel"><div className="team-filters" aria-label="Filter heroes">{(["ALL", "WORKING", "RESTING"] as const).map((value) => <button type="button" key={value} aria-pressed={filter === value} onClick={() => setFilter(value)}>{value} <small>{value === "ALL" ? heroes.length : value === "WORKING" ? working.length : heroes.filter((hero) => hero.status === "IDLE").length}</small></button>)}</div><div className="team-roster-scroll">{visible.map((hero) => <button type="button" key={hero.id} className={`team-hero${selected?.id === hero.id ? " selected" : ""}`} style={{ "--hero-rarity": RARITY_INFO[hero.rarity].color } as CSSProperties} onClick={() => setSelectedId(hero.id)} aria-pressed={selected?.id === hero.id}><span className="team-hero-sprite"><GameSprite kind={HERO_ART[hero.class].id} scale={1.8} /></span><span className="team-hero-main"><strong>{HERO_ART[hero.class].name} <small>#{hero.id.slice(-5)}</small></strong><small>{RARITY_INFO[hero.rarity].name} · ATK {hero.atk} · SPD {hero.spd}</small><span className="team-mini-bars"><i style={{ width: pct(hero.stamina, hero.maxStamina) }} /><i style={{ width: pct(hero.shield, hero.shieldMax) }} /></span><small>DUR {Math.floor(hero.stamina)}/{hero.maxStamina} · SHIELD {Math.floor(hero.shield).toLocaleString("en-US")}/{hero.shieldMax.toLocaleString("en-US")}</small></span><span className="team-hero-status">{hero.status === "HUNTING" ? "WORKING" : hero.status === "LISTED" ? "LISTED" : "RESTING"}</span></button>)}{!visible.length && <p className="team-empty">No heroes in this group.</p>}</div></div>
      <div className="team-detail page-panel">{selected ? <><div className="team-detail-head"><div className="team-detail-sprite"><GameSprite kind={HERO_ART[selected.class].id} scale={3.8} /></div><div><small>{RARITY_INFO[selected.rarity].name} · #{selected.id.slice(-5)}</small><h2>{HERO_ART[selected.class].name}</h2><span>{selected.status === "HUNTING" ? "WORKING IN DUNGEON" : selected.status === "LISTED" ? "LISTED ON MARKET" : "RESTING"}</span></div></div><div className="team-stats"><span>ATK <strong>{selected.atk}</strong></span><span>ATK SPD <strong>{selected.spd}</strong></span><span>LEVEL <strong>{selected.level}</strong></span><span>SHIELD LV <strong>{selected.shieldLevel}</strong></span></div><div className="team-meter"><span>WEAPON DURABILITY <strong>{Math.floor(selected.stamina)} / {selected.maxStamina}</strong></span><div><i style={{ width: pct(selected.stamina, selected.maxStamina) }} /></div></div><div className="team-meter shield"><span>HERO SHIELD <strong>{Math.floor(selected.shield).toLocaleString("en-US")} / {selected.shieldMax.toLocaleString("en-US")}</strong></span><div><i style={{ width: pct(selected.shield, selected.shieldMax) }} /></div></div><div className="team-detail-skills"><small>SKILLS</small><p>{selected.skills.length ? selected.skills.map((skill) => SKILL_LABELS[skill]).join(" · ") : "No special skills"}</p></div><div className="team-actions">{selected.status === "HUNTING" ? <button type="button" disabled={busy} onClick={() => void act(() => api.restHero(token, selected.id), "Hero is resting.")}>REST HERO</button> : <button type="button" disabled={busy || selected.status !== "IDLE" || selected.stamina <= 0 || selected.shield <= 0} onClick={() => void act(() => deploy({ heroId: selected.id }), "Hero sent to work.")}>GO WORK</button>}<Link to={`/armory?hero=${encodeURIComponent(selected.id)}`}>REPAIR · EQUIP ↗</Link></div></> : <p className="team-empty">Summon a hero to build your team.</p>}</div>
    </div>
  </section>;
}
