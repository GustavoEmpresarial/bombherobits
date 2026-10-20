import { PageHeading, PageState } from "../components/Page";
import { useState } from "react";
import { useRuntimeConfig } from "../state/RuntimeConfig";
import { api } from "../lib/api";
import { useAuth } from "../state/AuthContext";
import { useWorld } from "./useWorld";

export function WithdrawPage() {
  const {ECONOMY,config}=useRuntimeConfig();
  const { token, setUser } = useAuth();
  const { world, error, busy, setError, reload } = useWorld();
  const [submitting, setSubmitting] = useState(false);
  if (!world || !token) return <PageState error={error} retry={() => window.location.reload()} />;

  const chest = world.user.chest;
  const fee = Math.round(chest * ECONOMY.WITHDRAW_FEE * 100) / 100;
  const net = Math.max(0, chest - fee);
  const ready = chest >= ECONOMY.WITHDRAW_MIN;

  return (
    <section className="page" aria-label="WITHDRAW">
      <PageHeading eyebrow="REWARD TRANSFER" title="Bring your treasure home." description="Review the amount and fee before moving rewards to your game balance." />
      <section className="page-panel summon-buy withdraw-layout">
        <h2 className="page-panel-title">Transfer rewards</h2>
        <div className="summon-total">
          <span>In the chest</span>
          <strong>{chest.toLocaleString("en-US", { maximumFractionDigits: 2 })}</strong>
        </div>
        <div className="withdraw-progress">
          <span className="withdraw-bar">
            <i style={{ width: `${Math.min(100, (chest / ECONOMY.WITHDRAW_MIN) * 100)}%` }} />
          </span>
          <p className="page-note">
            {ready
              ? "Ready to move into your gold balance."
              : `${(ECONOMY.WITHDRAW_MIN - chest).toLocaleString("en-US")} MHDG to go`}
          </p>
        </div>
        <div className="summon-total">
          <span>Fee ({Math.round(ECONOMY.WITHDRAW_FEE * 100)}%)</span>
          <strong>-{ready ? fee.toLocaleString("en-US") : "—"}</strong>
        </div>
        <div className="summon-total">
          <span>You receive</span>
          <strong>{ready ? net.toLocaleString("en-US") : "—"}</strong>
        </div>
        <button
          type="button"
          className="cta cta-main cta-big"
          disabled={busy || submitting || !ready}
          onClick={() => {
            if (submitting) return;
            setSubmitting(true);
            setError("");
            void api
              .withdraw(token)
              .then(async (res) => { setUser(res.user); await reload(); })
              .catch((e) => setError(e instanceof Error ? e.message : "Transfer failed"))
              .finally(() => setSubmitting(false));
          }}
        >
          {submitting ? "TRANSFERRING…" : "TRANSFER TO GAME BALANCE"}
        </button>
        {error && <p className="error-line">{error}</p>}
      </section>
    </section>
  );
}
