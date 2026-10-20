import { useSummons } from "../state/SummonContext";
import { PendingSummonPacks } from "../components/PendingSummonPacks";
import { PageHeading, PageState } from "../components/Page";
import { useRuntimeConfig } from "../state/RuntimeConfig";
import { Link } from "react-router-dom";
import { useAuth } from "../state/AuthContext";
import { useWorld } from "./useWorld";

export function ChestPage() {
  const {ECONOMY}=useRuntimeConfig();
  const { token,user } = useAuth();
  const summons=useSummons();
  const { world, error, busy } = useWorld();
  if (!world || !token) return <PageState error={error} retry={() => window.location.reload()} />;

  const ready = world.user.chest >= ECONOMY.WITHDRAW_MIN;
  const mintCards=user?.mintCards??world.user.mintCards;

  return (
    <section className="page" aria-label="CHEST">
      <PageHeading eyebrow="YOUR TREASURE ROOM" title="Every adventure brings something back." description="Manage your hunting rewards and the rescue cards waiting to be opened." />
      <PendingSummonPacks/>
      <div className="chest-rewards">
        <section className="page-panel chest-reward">
          <span className="reward-symbol" aria-hidden="true">◆</span><h3 className="page-panel-title">Hunting rewards</h3>
          <strong className="chest-value">
            <span className="icon-coin" />
            {world.user.chest.toLocaleString("en-US", { maximumFractionDigits: 2 })}
          </strong>
          <p className="page-note">
            {ready ? "Ready to transfer to your game balance" : `Transfer from ${ECONOMY.WITHDRAW_MIN} MHDG`}
          </p>
          <Link to="/withdraw" className="cta cta-main">REVIEW TRANSFER <span>→</span></Link>
        </section>
        <section className="page-panel chest-reward">
          <span className="reward-symbol violet" aria-hidden="true">✦</span><h3 className="page-panel-title">Hero rescue</h3>
          <strong className="chest-value">{mintCards}</strong>
          <p className="page-note">From bosses and invites</p>
          <div className="chest-opens">
            {ECONOMY.MINT_PACKS.map((count) => (
              <button
                key={count}
                type="button"
                className="cta cta-main"
                disabled={busy || summons.busy || mintCards < count}
                onClick={() => void summons.purchase("CARDS",count)}
              >
                REDEEM {count}
              </button>
            ))}
          </div>
        </section>
      </div>
      {error && <p className="error-line">{error}</p>}
    </section>
  );
}
