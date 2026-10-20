import { useEffect, useRef, useState, type CSSProperties } from "react";
import { Link } from "react-router-dom";
import { PartySprite } from "./PartySprite";
import { RARITY_INFO, type DungeonSnapshot } from "@herobits/shared";
import { HERO_ART } from "../lib/characters";
import "./hero-sidebar.css";
import {useRuntimeConfig} from "../state/RuntimeConfig";

type Filter = "all" | "working" | "resting";

type HeroSidebarProps = {
  open: boolean;
  snapshot: DungeonSnapshot | null;
  busy: boolean;
  error: string;
  onToggle: () => void;
  onClose: () => void;
  onWork: (id?: string) => void;
  onRest: (ids: string[]) => void;
};

export function HeroSidebar({ open, snapshot, busy, error, onToggle, onClose, onWork, onRest }: HeroSidebarProps) {
  const {GAME,config}=useRuntimeConfig();
  const RANGE={WARRIOR:config.heroes.classes.WARRIOR.range,ROGUE:config.heroes.classes.ROGUE.range,MAGE:config.heroes.classes.MAGE.range};
  const [filter, setFilter] = useState<Filter>("all");
  const toggleRef = useRef<HTMLButtonElement>(null);
  const heroes = snapshot?.heroes ?? [];
  const working = heroes.filter((hero) => hero.status === "HUNTING").length;
  const ready = heroes.filter((hero) => hero.status === "IDLE" && hero.stamina > 0).length;
  const resting = heroes.filter((hero) => hero.status === "IDLE").length;
  const restable = heroes.filter((hero) => hero.status === "HUNTING");
  const capacity = snapshot?.maxWorking ?? GAME.MAX_WORKING_HEROES;
  const shown = heroes.filter((hero) => filter === "all" || (filter === "working" ? hero.status === "HUNTING" : hero.status === "IDLE"));

  function close() {
    // Keep keyboard focus on a visible control when the drawer becomes inert.
    toggleRef.current?.focus();
    onClose();
  }

  useEffect(() => {
    if (!open) return;
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        toggleRef.current?.focus();
        onClose();
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, onClose]);

  return (
    <aside className="hero-sidebar" data-open={open} aria-label="Arena heroes">
      <button ref={toggleRef} type="button" className="hero-sidebar-handle" aria-label={open ? "Hide heroes" : "Show heroes"} aria-expanded={open} aria-controls="arena-hero-panel" onClick={onToggle}>
        <span className="hero-sidebar-chevron" aria-hidden>{open ? "›" : "‹"}</span>
        <img src="/ui/icon-hero.png" alt="" />
        <span>HEROES</span>
        <small>{working}/{capacity}</small>
      </button>

      <div id="arena-hero-panel" className="hero-sidebar-panel" inert={!open} aria-hidden={!open}>
        <header className="hero-sidebar-heading">
          <div><span className="hero-sidebar-eyebrow">YOUR PARTY</span><h2>HEROES <span>{heroes.length}</span></h2></div>
          <button type="button" className="hero-sidebar-close" onClick={close} aria-label="Close heroes panel">×</button>
        </header>
        <div className="hero-sidebar-summary">
          <span><i aria-hidden /> <strong>{working}/{capacity}</strong> working</span>
          <span>{ready} ready</span>
        </div>
        <div className="hero-sidebar-bulk" role="group" aria-label="Party actions">
          <button type="button" className="hero-party-action hero-party-work" disabled={busy || !snapshot || ready === 0 || working >= capacity} onClick={() => onWork()}>WORK ALL <span>{Math.min(ready, Math.max(0, capacity - working))}</span></button>
          <button type="button" className="hero-party-action hero-party-rest" disabled={busy || restable.length === 0} onClick={() => onRest(restable.map((hero) => hero.id))}>REST ALL <span>{restable.length}</span></button>
        </div>
        {error && <p className="hero-sidebar-error" role="alert">{error}</p>}
        <div className="hero-sidebar-filters" role="group" aria-label="Filter arena heroes">
          {([["all", "All", heroes.length], ["working", "Working", working], ["resting", "Resting", resting]] as const).map(([value, label, count]) => (
            <button key={value} type="button" aria-pressed={filter === value} onClick={() => setFilter(value)}>{label} <span>{count}</span></button>
          ))}
        </div>

        <div className="hero-sidebar-list" aria-label="Hero roster" aria-busy={busy || !snapshot}>
          {!snapshot ? <p className="hero-sidebar-empty">{error ? "Your party could not be loaded." : "Loading your party…"}</p> : shown.length === 0 ? (
            <div className="hero-sidebar-empty"><img src="/ui/icon-hero.png" alt="" /><p>{heroes.length === 0 ? "Your next adventure starts with a hero." : filter === "working" ? "No heroes are working. Send a rested hero into the arena." : "No heroes in this group."}</p>{heroes.length === 0 && <Link to="/shop/summon">SUMMON A HERO →</Link>}</div>
          ) : shown.map((hero) => {
            const art = HERO_ART[hero.class];
            const hunting = hero.status === "HUNTING";
            const listed = hero.status === "LISTED";
            const exhausted = hero.stamina <= 0;
            const stamina = Math.max(0, Math.min(100, hero.stamina / Math.max(1, hero.maxStamina) * 100));
            const status = listed ? "On market" : hunting ? "Working" : hero.stamina < hero.maxStamina ? "Recovering" : "Ready";
            return (
              <article key={hero.id} className="hero-party-card" data-status={hero.status.toLowerCase()} style={{ "--hero-rarity": RARITY_INFO[hero.rarity].color } as CSSProperties}>
                <div className="hero-party-portrait" data-kind={art.id} aria-hidden><PartySprite kind={art.id} working={hunting} active={open} /></div>
                <div className="hero-party-info">
                  <div className="hero-party-name"><strong>{art.name}</strong><small>#{hero.id.slice(-5)}</small></div>
                  <div className="hero-party-meta"><span>{RARITY_INFO[hero.rarity].name}</span><small>LV {hero.level}</small></div>
                  <div className="hero-party-stamina" role="progressbar" aria-label={`${art.name} stamina`} aria-valuemin={0} aria-valuemax={hero.maxStamina} aria-valuenow={hero.stamina} data-low={stamina < 25}><span style={{ width: `${stamina}%` }} /></div>
                  <div className="hero-party-energy"><span>{hero.stamina}/{hero.maxStamina} STA</span><span className="hero-party-status">{status}</span></div>
                  <div className="hero-party-stats"><span title="Attack">ATK <b>{hero.atk}</b></span><span title="Speed">SPD <b>{hero.spd}</b></span><span title="Range">RNG <b>{RANGE[hero.class]}</b></span></div>
                </div>
                <div className="hero-party-controls">
                  {listed ? <span className="hero-party-listed">LISTED</span> : hunting || exhausted ? (
                    <button type="button" className="hero-party-action hero-party-rest" disabled={busy || exhausted} title={exhausted ? "Stamina is recovering automatically" : "Recall this hero to recover stamina"} aria-label={`Rest ${art.name} ${hero.id.slice(-5)}`} onClick={() => onRest([hero.id])}>{exhausted ? "RESTING" : "REST"}</button>
                  ) : <>
                    <button type="button" className="hero-party-action hero-party-work" disabled={busy || working >= capacity} title={working >= capacity ? "Your working party is full" : `Send ${art.name} to work`} aria-label={`Work ${art.name} ${hero.id.slice(-5)}`} onClick={() => onWork(hero.id)}>WORK</button>
                  </>}
                </div>
              </article>
            );
          })}
        </div>
        <footer className="hero-sidebar-footer"><span>{busy ? "Updating party…" : "Resting heroes recover stamina automatically"}</span></footer>
      </div>
    </aside>
  );
}
