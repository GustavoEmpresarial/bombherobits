import { useEffect, useMemo, useState, type CSSProperties } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { RARITY_INFO, SCRAP_YIELD, SHIELD_MAX_LEVEL, SKILL_LABELS, shieldRepairCost, shieldUpgradeCost, type HeroDto } from "@herobits/shared";
import { GameSprite } from "../components/GameSprite";
import { PageHeading, PageState } from "../components/Page";
import { HERO_ART } from "../lib/characters";
import { api } from "../lib/api";
import { useAuth } from "../state/AuthContext";
import "./armory.css";
import { EquipmentPanel } from "./EquipmentPanel";

const formatShield = (value: number) => value.toLocaleString("en-US");

export function ArmoryPage() {
  const { token, user, setUser } = useAuth();
  const [params, setParams] = useSearchParams();
  const [heroes, setHeroes] = useState<HeroDto[] | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [confirmScrap, setConfirmScrap] = useState<string | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!token) return;
    let active = true;
    void api.heroes(token).then((rows) => { if (active) setHeroes(rows); }).catch((cause) => {
      if (active) setError(cause instanceof Error ? cause.message : "Could not load heroes");
    });
    return () => { active = false; };
  }, [token]);

  const sorted = useMemo(() => [...(heroes ?? [])].sort((a, b) =>
    a.shield / Math.max(1, a.shieldMax) - b.shield / Math.max(1, b.shieldMax) || a.id.localeCompare(b.id)), [heroes]);
  const selected = sorted.find((hero) => hero.id === params.get("hero")) ?? sorted[0];

  async function act(action: "scrap" | "repair" | "upgrade") {
    if (!token || !selected || busyId) return;
    setBusyId(selected.id); setError("");
    try {
      const result = action === "scrap" ? await api.scrapHero(token, selected.id)
        : action === "repair" ? await api.repairShield(token, selected.id)
          : await api.upgradeShield(token, selected.id);
      setUser(result.user);
      setHeroes(await api.heroes(token));
      if (action === "scrap") { setParams({}); setConfirmScrap(null); }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not update this hero");
    } finally { setBusyId(null); }
  }

  if (!token || !heroes) return <PageState error={error} retry={() => window.location.reload()} />;
  const repairCost = selected ? shieldRepairCost(selected.rarity, selected.shieldLevel, selected.shield, selected.shieldMax) : 0;
  const upgradeCost = selected ? shieldUpgradeCost(selected.rarity) : 0;

  return <section className="page armory-page" aria-label="ARMORY">
    <PageHeading eyebrow="THE SHIELD WORKSHOP" title="Keep the party standing." description="Shields wear down during the hunt. Rest a hero, repair with Scrap or strengthen the shield before the next run." />
    <div className="armory-currencies page-panel"><span>YOUR SCRAP <strong>{user?.scrap ?? 0}</strong></span><span>GAME GOLD <strong>{user?.gold.toLocaleString("en-US", { maximumFractionDigits: 2 }) ?? 0}</strong></span><Link to="/shop/scrap">BUY SCRAP ↗</Link></div>
    {error && <p className="error-line" role="alert">{error}</p>}
    <div className="armory-layout">
      <div className="armory-roster page-panel" aria-label="Choose a hero">
        {sorted.map((hero) => <button type="button" key={hero.id} className={`armory-roster-hero${selected?.id === hero.id ? " selected" : ""}`} onClick={() => { setParams({ hero: hero.id }); setConfirmScrap(null); }} aria-pressed={selected?.id === hero.id} style={{ "--rarity": RARITY_INFO[hero.rarity].color } as CSSProperties}>
          <GameSprite kind={HERO_ART[hero.class].id} scale={1.6} />
          <span><strong>{HERO_ART[hero.class].name}</strong><small>{RARITY_INFO[hero.rarity].name} · #{hero.id.slice(-5)}</small></span>
          <span className="armory-roster-shield">{formatShield(hero.shield)}/{formatShield(hero.shieldMax)}<small>SHIELD</small></span>
        </button>)}
        {!sorted.length && <p className="armory-empty">No heroes yet. Open a hero card to begin your party.</p>}
      </div>
      {selected && <article className="armory-detail page-panel" style={{ "--rarity": RARITY_INFO[selected.rarity].color } as CSSProperties}>
        <div className="armory-portrait"><GameSprite kind={HERO_ART[selected.class].id} scale={4} /></div>
        <div className="armory-name"><small>{RARITY_INFO[selected.rarity].name} · LEVEL {selected.level}</small><h2>{HERO_ART[selected.class].name}</h2><span>{selected.status === "HUNTING" ? "WORKING" : selected.status === "LISTED" ? "ON MARKET" : "RESTING"}</span></div>
        <div className="armory-shield"><div><strong>SHIELD · LEVEL {selected.shieldLevel}</strong><span>{formatShield(selected.shield)} / {formatShield(selected.shieldMax)}</span></div><div className="armory-shield-track"><span style={{ width: `${Math.max(0, Math.min(100, selected.shield / selected.shieldMax * 100))}%` }} /></div></div>
        <div className="armory-skills"><strong>HERO SKILLS</strong><div>{selected.skills.length ? selected.skills.map((skill) => <span key={skill}>{SKILL_LABELS[skill]}</span>) : <small>No skills recorded</small>}</div></div>
        <div className="armory-actions">
          <button type="button" className="cta cta-main" disabled={!!busyId || selected.status !== "IDLE" || !repairCost || (user?.scrap ?? 0) < repairCost} onClick={() => void act("repair")}>REPAIR · {repairCost} SCRAP</button>
          <button type="button" className="cta-alt" disabled={!!busyId || selected.status !== "IDLE" || selected.shieldLevel >= SHIELD_MAX_LEVEL || (user?.scrap ?? 0) < upgradeCost} onClick={() => void act("upgrade")}>UPGRADE · {upgradeCost} SCRAP</button>
        </div>
        <div className="armory-scrap"><p>Scrapping permanently removes this hero and grants <strong>{SCRAP_YIELD[selected.rarity]} Scrap</strong>.</p>{confirmScrap === selected.id ? <div><button type="button" className="armory-danger" disabled={!!busyId || selected.status !== "IDLE"} onClick={() => void act("scrap")}>CONFIRM SCRAP</button><button type="button" className="cta-alt" onClick={() => setConfirmScrap(null)}>CANCEL</button></div> : <button type="button" className="cta-alt" disabled={!!busyId || selected.status !== "IDLE"} onClick={() => setConfirmScrap(selected.id)}>SCRAP HERO</button>}</div>
      </article>}
    </div>
    <EquipmentPanel token={token} user={user} setUser={setUser} hero={selected} />
  </section>;
}
