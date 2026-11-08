import { recoveryHouse } from "../lib/houses";
import { PageState } from "../components/Page";
import { useRuntimeConfig } from "../state/RuntimeConfig";
import { api } from "../lib/api";
import { useWorld } from "./useWorld";
import { HERO_RARITIES, RARITY_INFO } from "@herobits/shared";
import type { CSSProperties } from "react";
import "./porter-repair.css";

export function PorterPage() {
  const {ECONOMY}=useRuntimeConfig();
  const { token, world, error, busy, run } = useWorld();
  if (!world || !token) return <PageState error={error} retry={() => window.location.reload()} />;

  return (
    <section className="page" aria-label="PORTER">
      <section className="page-panel porter-panel">
        <div className="porter-art" aria-hidden>
          <span className="porter-loop" />
        </div>
        <div className="porter-info">
          <h2 className="page-panel-title">Porter</h2>
          <span className="porter-kind">Auto Return</span>
          <p className="page-panel-text">
            While the dungeon is open, the porter sends resting heroes back to work at 80% energy. It keeps the strongest available heroes in the arena, replacing a weaker worker when all slots are full.
          </p>
          {world.porters > 0 && (
            <div className="porter-switch-row">
              <button
                type="button"
                className="cta cta-main"
                disabled={busy}
                onClick={() => void run(() => api.togglePorter(token))}
              >
                {world.porterOn ? "ON" : "OFF"}
              </button>
              <span className="page-note">
                {world.porterOn
                  ? "Switch it off to manage your resting heroes yourself."
                  : "Off: manage work and rest from the dungeon hero panel."}
              </span>
            </div>
          )}
          {world.porters > 0 && <section className="porter-repair" aria-label="Automatic shield repair">
            <div className="porter-repair-heading">
              <div><small>KEEP THE PARTY READY</small><h3>Auto-repair shields</h3></div>
              <button type="button" role="switch" aria-checked={world.shieldRepairOn} className={`porter-repair-toggle${world.shieldRepairOn ? " is-on" : ""}`}
                disabled={busy} onClick={() => void run(() => api.setShieldRepair(token, !world.shieldRepairOn))}>
                {world.shieldRepairOn ? "ON" : "OFF"}
              </button>
            </div>
            <p>While the hunt is open, your porter repairs broken shields with Scrap, strongest heroes first. Each repair costs the full price for that shield level.</p>
            {world.shieldRepairOn && <div className="porter-repair-rarities" role="group" aria-label="Rarities the porter repairs">
              {HERO_RARITIES.map(rarity => {
                const enabled = world.shieldRepairRarities.includes(rarity);
                return <button key={rarity} type="button" role="switch" aria-checked={enabled}
                  style={{ "--rarity-color": RARITY_INFO[rarity].color } as CSSProperties}
                  className={`porter-repair-rarity${enabled ? " is-on" : ""}`} disabled={busy}
                  onClick={() => void run(() => api.setShieldRepairRarity(token, rarity, !enabled))}>
                  <span aria-hidden="true">{enabled ? "◆" : "◇"}</span>{RARITY_INFO[rarity].name}
                </button>;
              })}
            </div>}
            <small className="porter-repair-note">{world.user.scrap} Scrap available · {world.porterOn ? "Porter active" : "Turn the porter on to start automatic repairs"}</small>
          </section>}
          <div className="porter-reqs">
            <p>Active recovery house: {world.blacksmiths.some(row => row.inService) ? recoveryHouse(world.blacksmiths.find(row => row.inService)!.tier).name : "None"}</p>
            <p>Porters owned: {world.porters}</p>
          </div>
          <div className="porter-buy">
            <div className="porter-price">
              <span className="icon-coin" />
              <strong className="porter-price-value">
                {ECONOMY.PORTER_PRICE.toLocaleString("en-US")}
              </strong>
            </div>
            <p className="page-note">
              One porter is enough. Paid from your gold.
            </p>
            <button
              type="button"
              className="cta cta-main cta-big"
              disabled={busy || world.porters > 0 || !world.serviceName || world.user.gold < ECONOMY.PORTER_PRICE}
              onClick={() => void run(() => api.buyPorter(token))}
            >
              BUY
            </button>
          </div>
          {error && <p className="error-line">{error}</p>}
        </div>
      </section>
    </section>
  );
}
