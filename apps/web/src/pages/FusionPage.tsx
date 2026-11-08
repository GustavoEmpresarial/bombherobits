import { useEffect, useRef, useState, type CSSProperties } from "react";
import { FUSION_INPUT_COUNT, FUSION_STEPS, fusionResultRarity, type FusionResultDto, type HeroDto, type HeroRarity } from "@herobits/shared";
import { GameSprite } from "../components/GameSprite";
import { PageHeading, PageState } from "../components/Page";
import { HERO_ART } from "../lib/characters";
import { api } from "../lib/api";
import { useAuth } from "../state/AuthContext";
import "./fusion.css";

const accent: Record<HeroRarity, string> = {
  COMMON: "#a9b6c5", RARE: "#4d9cff", SUPER_RARE: "#8c69ff",
  EPIC: "#c54dff", LEGENDARY: "#f4c64d", SUPER_LEGENDARY: "#ff655e",
};
const label = (rarity: HeroRarity) => rarity.replaceAll("_", " ");

export function FusionPage() {
  const { token } = useAuth();
  const [heroes, setHeroes] = useState<HeroDto[] | null>(null);
  const [rarity, setRarity] = useState<HeroRarity>("COMMON");
  const [selected, setSelected] = useState<string[]>([]);
  const [result, setResult] = useState<FusionResultDto | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const pending = useRef<{ ids: string; key: string } | null>(null);

  useEffect(() => {
    if (!token) return;
    let active = true;
    void api.heroes(token).then((items) => { if (active) setHeroes(items); }).catch((cause) => {
      if (active) setError(cause instanceof Error ? cause.message : "Could not load heroes");
    });
    return () => { active = false; };
  }, [token]);

  if (!token || !heroes) return <PageState error={error} retry={() => window.location.reload()} />;

  const eligible = heroes.filter((hero) => hero.rarity === rarity && hero.status === "IDLE");
  const next = fusionResultRarity(rarity, false);
  const toggle = (id: string) => {
    pending.current = null;
    setResult(null);
    setError("");
    setSelected((current) => current.includes(id) ? current.filter((item) => item !== id) : current.length < FUSION_INPUT_COUNT ? [...current, id] : current);
  };
  const fuse = async () => {
    if (!token || selected.length !== FUSION_INPUT_COUNT || busy) return;
    setBusy(true);
    setError("");
    const ids = [...selected].sort().join(",");
    if (!pending.current || pending.current.ids !== ids) pending.current = { ids, key: crypto.randomUUID() };
    try {
      const fusion = await api.fuseHeroes(token, selected, pending.current.key);
      const updated = await api.heroes(token);
      setHeroes(updated);
      setSelected([]);
      setResult(fusion);
      pending.current = null;
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Fusion failed");
    } finally {
      setBusy(false);
    }
  };

  return <section className="page fusion-page" aria-label="FUSION">
    <PageHeading eyebrow="THE SCARAB ALTAR" title="Four sparks. One stronger hero." description="Choose four resting heroes of the same rarity. The altar returns one hero from the next rarity; a rare critical fusion skips a step." />
    <div className="fusion-layout">
      <div className="fusion-altar page-panel">
        <div className="fusion-altar-art"><img src="/shop/fusion-altar.png" alt="A scarab altar joining four hero sparks" /></div>
        <div className="fusion-flow"><strong>{label(rarity)}</strong><span aria-hidden="true">✦ → ✦</span><strong>{next ? label(next) : "MAX RARITY"}</strong></div>
        <div className="fusion-slots" aria-label={`${selected.length} of ${FUSION_INPUT_COUNT} heroes selected`}>
          {Array.from({ length: FUSION_INPUT_COUNT }, (_, index) => {
            const hero = heroes.find((item) => item.id === selected[index]);
            return <div className="fusion-slot" key={index}>
              {hero ? <GameSprite kind={HERO_ART[hero.class].id} scale={2} /> : <span className="fusion-slot-empty">{index + 1}</span>}
            </div>;
          })}
        </div>
        <button className="cta cta-main fusion-action" type="button" disabled={busy || selected.length !== FUSION_INPUT_COUNT} onClick={() => void fuse()}>{busy ? "FUSING…" : `FUSE ${FUSION_INPUT_COUNT} HEROES`}</button>
        <p className="fusion-warning">The four selected heroes are consumed. Working and listed heroes cannot be used.</p>
        {error && <p className="error-line" role="alert">{error}</p>}
        {result && <div className="fusion-result" role="status" style={{ "--fusion-accent": accent[result.resultRarity] } as CSSProperties}>
          <span>{result.critical ? "CRITICAL FUSION!" : "FUSION COMPLETE"}</span>
          <GameSprite kind={HERO_ART[result.hero.class].id} scale={3} />
          <strong>{HERO_ART[result.hero.class].name}</strong>
          <small>{label(result.resultRarity)} · ATK {result.hero.atk} · STA {result.hero.maxStamina}</small>
        </div>}
      </div>
      <div className="fusion-roster page-panel">
        <div className="fusion-rarity-tabs" aria-label="Fusion rarity">
          {FUSION_STEPS.slice(0, -2).map((step) => <button type="button" key={step} className={rarity === step ? "active" : ""} onClick={() => { setRarity(step); setSelected([]); setResult(null); pending.current = null; }}>{label(step)} <small>{heroes.filter((hero) => hero.rarity === step && hero.status === "IDLE").length}</small></button>)}
        </div>
        <p className="fusion-roster-note">{eligible.length} resting {label(rarity).toLowerCase()} heroes · select four</p>
        <div className="fusion-hero-grid">
          {eligible.map((hero) => <button type="button" key={hero.id} className={`fusion-hero${selected.includes(hero.id) ? " selected" : ""}`} style={{ "--fusion-accent": accent[hero.rarity] } as CSSProperties} onClick={() => toggle(hero.id)} aria-pressed={selected.includes(hero.id)}>
            <GameSprite kind={HERO_ART[hero.class].id} scale={2} />
            <strong>{HERO_ART[hero.class].name}</strong><small>ATK {hero.atk} · STA {hero.stamina}/{hero.maxStamina}</small>
            <span>{selected.includes(hero.id) ? "SELECTED ✓" : "SELECT"}</span>
          </button>)}
          {!eligible.length && <div className="fusion-empty">No resting heroes of this rarity. Summon more or let your party rest.</div>}
        </div>
      </div>
    </div>
  </section>;
}
