import { Link } from "react-router-dom";

export function StakePage() {
  return <section className="page stake-page" aria-label="Stake">
    <div className="page-panel coming-soon stake-announcement">
      <span className="stake-mark" aria-hidden="true">✦</span>
      <span className="hero-sidebar-eyebrow">THE NEXT CHAPTER</span>
      <h2 className="page-panel-title">STAKING</h2>
      <p className="page-panel-text">Coming soon. Staking is not open, and no wallet transaction is available here yet.</p>
      <Link className="cta cta-main" to="/">BACK TO THE GAME</Link>
    </div>
  </section>;
}
