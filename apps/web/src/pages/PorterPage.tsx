import { recoveryHouse } from "../lib/houses";
import { PageState } from "../components/Page";
import { useRuntimeConfig } from "../state/RuntimeConfig";
import { api } from "../lib/api";
import { useWorld } from "./useWorld";

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
            While the game is open, the porter looks after your recovery house and keeps your party moving.
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
