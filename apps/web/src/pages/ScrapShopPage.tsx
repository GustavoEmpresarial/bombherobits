import { useState } from "react";
import { Link } from "react-router-dom";
import { SCRAP_PACKS, SHIELD_REPAIR_UNITS_PER_SCRAP } from "@herobits/shared";
import { PageHeading } from "../components/Page";
import { api } from "../lib/api";
import { useAuth } from "../state/AuthContext";
import "./scrap-shop.css";

export function ScrapShopPage() {
  const { token, user, setUser } = useAuth();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  async function buy(amount: number, source: "gold" | "chest") {
    if (!token || busy !== null) return;
    setBusy(`${amount}-${source}`); setError(""); setNotice("");
    try {
      const result = await api.buyScrap(token, amount, source);
      setUser(result.user);
      setNotice(`${result.scrap} Scrap added to your inventory. Your heroes can be repaired now.`);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not buy Scrap");
    } finally { setBusy(null); }
  }

  return <section className="page scrap-shop-page" aria-label="Scrap shop">
    <PageHeading eyebrow="THE SHIELD FORGE" title="Give your heroes another life." description="Buy Scrap with your game balance or hunting chest, then restore a resting hero's shield in the Armory. A broken shield keeps that hero out of the hunt." />
    <div className="scrap-shop-summary page-panel"><span>YOUR SCRAP <strong>{user?.scrap ?? 0}</strong></span><span>GAME BALANCE <strong>{user?.gold.toLocaleString("en-US", { maximumFractionDigits: 2 }) ?? 0}</strong></span><span>HUNT CHEST <strong>{user?.chest.toLocaleString("en-US", { maximumFractionDigits: 2 }) ?? 0}</strong></span><Link to="/armory">OPEN ARMORY ↗</Link></div>
    {error && <p className="error-line" role="alert">{error}</p>}
    {notice && <p className="scrap-shop-success" role="status">{notice}</p>}
    <div className="scrap-shop-packs">
      {SCRAP_PACKS.map((pack, index) => <article key={pack.scrap} className="scrap-pack page-panel">
        <div className="scrap-pack-art" aria-hidden><span className="scrap-gem scrap-gem-one" /><span className="scrap-gem scrap-gem-two" /><span className="scrap-gem scrap-gem-three" /></div>
        <small>PACK 0{index + 1}</small><h2>{pack.scrap} <span>SCRAP</span></h2>
        <p>1 Scrap covers {SHIELD_REPAIR_UNITS_PER_SCRAP.toLocaleString("en-US")} shield capacity. Repairs cost a fixed amount by rarity and shield level.</p>
        <div className="scrap-pack-footer"><strong>{pack.gold} GOLD</strong><div className="scrap-pack-actions"><button type="button" className="cta cta-main" disabled={!token || busy !== null || (user?.gold ?? 0) < pack.gold} onClick={() => void buy(pack.scrap, "gold")}>{busy === `${pack.scrap}-gold` ? "BUYING…" : "BUY"}</button><button type="button" className="cta-alt" disabled={!token || busy !== null || (user?.chest ?? 0) < pack.gold} onClick={() => void buy(pack.scrap, "chest")}>{busy === `${pack.scrap}-chest` ? "BUYING…" : "WITH CHEST"}</button></div></div>
      </article>)}
    </div>
    <p className="scrap-shop-note">Scrap also comes from retiring spare heroes. A repair always refills the whole shield for its fixed rarity and level price, even if only a little is missing.</p>
  </section>;
}
