import { useRuntimeConfig } from "../state/RuntimeConfig";
import { PageState } from "../components/Page";
import { Link } from "react-router-dom";
import type { CSSProperties } from "react";
import { api } from "../lib/api";
import { recoveryHouse } from "../lib/houses";
import { RecoveryHouse } from "../components/RecoveryHouse";
import { useWorld } from "./useWorld";

export function BlacksmithPage() {
  const { config } = useRuntimeConfig();
  const { token, world, error, busy, run } = useWorld();
  if (!world || !token) return <PageState error={error} retry={() => window.location.reload()} />;
  const next = (world.blacksmiths.at(-1)?.tier ?? 0) + 1;
  const serving = world.blacksmiths.find(house => house.inService);
  const serviceSpec = world.catalog.find(house => house.tier === serving?.tier);

  return <section className="page recovery-houses-page" aria-label="RECOVERY HOUSES">
    <header className="recovery-camp-header">
      <div><h2>Recovery houses</h2><p>A cozy home to recharge your heroes for the next hunt.</p></div>
      <div className="recovery-camp-owned"><strong>{world.blacksmiths.length}<span> / {world.catalog.length}</span></strong><small>HOUSES OWNED</small></div>
    </header>
    <div className="recovery-camp-service" role="status">
      <span className={`recovery-service-light${serving ? " on" : ""}`} aria-hidden="true" />
      <div><small>YOUR ACTIVE HOUSE</small><strong>{serving ? recoveryHouse(serving.tier).name : "No house active yet"}</strong></div>
      <p>{serviceSpec ? `${serviceSpec.slots} heroes · ${serviceSpec.rate} stamina/min each` : "Start with Ember Nook to give your party a place to rest."}</p>
      {serving && <Link to="/shop/porter" className="cta-alt">MEET YOUR PORTER ↗</Link>}
    </div>
    <p className="recovery-camp-rule">One house active at a time. Resting heroes in its slots recover faster; heroes outside recover {config.stamina.recoveryPerMinute} stamina/min.</p>
    {error && <p className="error-line" role="alert">{error}</p>}
    <div className="recovery-houses-grid" aria-label="Recovery house upgrades" aria-busy={busy}>
      {world.catalog.map(spec => {
        const house = recoveryHouse(spec.tier);
        const owned = world.blacksmiths.find(row => row.tier === spec.tier);
        const locked = !owned && spec.tier > next;
        const affordable = world.user.gold >= spec.price;
        const active = Boolean(owned?.inService);
        return <article key={spec.tier} className="recovery-house-card" data-active={active} style={{ "--house-accent": house.color } as CSSProperties}>
          <div className="recovery-house-top"><span>TIER {String(spec.tier).padStart(2,"0")}</span><span className="recovery-house-tag">{active ? "● ACTIVE" : owned ? "✓ OWNED" : locked ? "NEXT CHAPTER" : "AVAILABLE"}</span></div>
          <RecoveryHouse tier={spec.tier} active={active} />
          <div className="recovery-house-copy"><h3>{house.name}</h3><p>{house.mood}</p>
            <dl className="recovery-house-stats"><div><dt>CAPACITY</dt><dd>{spec.slots}<small> heroes</small></dd></div><div><dt>RECOVERY / HERO</dt><dd>{spec.rate}<small> STA/min</small></dd></div></dl>
            <div className="recovery-house-purchase">
              <strong className="recovery-house-price"><span className="icon-coin" aria-hidden="true" />{spec.price.toLocaleString("en-US")}<small>gold</small></strong>
              <button type="button" className={active ? "cta-alt" : "cta cta-main"} disabled={busy || active || (!owned && (locked || !affordable))} aria-label={active ? `${house.name} is active` : owned ? `Activate ${house.name}` : `Buy ${house.name}`} onClick={() => void run(() => owned ? api.setBlacksmith(token,owned.id) : api.buyBlacksmith(token,spec.tier))}>{active ? "IN SERVICE" : busy ? "UPDATING…" : owned ? "ACTIVATE" : locked ? "LOCKED" : "BUY HOUSE"}</button>
            </div>
            <small className="recovery-house-requirement">{active ? "Your heroes are welcome home." : owned ? "Activate this house to switch recovery slots." : locked ? `Requires ${recoveryHouse(spec.tier - 1).name}.` : !affordable ? "Not enough gold for this house yet." : "Paid from your game balance."}</small>
          </div>
        </article>;
      })}
    </div>
  </section>;
}
