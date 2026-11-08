import { BrandWordmark } from "../components/BrandWordmark";
import { Link } from "react-router-dom";
import { LootSprite } from "../components/LootSprite";
import { GameSprite } from "../components/GameSprite";
export function HomePage() {
  return <div className="screen screen-lobby">
    <div className="room-backdrop" aria-hidden="true" /><div className="room-shade" aria-hidden="true" />
    <div className="lobby-intro"><p className="game-wordmark"><BrandWordmark /></p></div>
    <nav className="lobby-modes" aria-label="Game modes">
      <Link className="mode mode-heroes" to="/dungeon"><div className="mode-card"><div className="mode-art art-heroes"><div className="card-art-party"><GameSprite scale={3} /><GameSprite kind="vesper" scale={4} /><GameSprite kind="cinder" scale={3} /></div><div className="art-ground" /></div><div className="mode-name">HEROES <span>↗</span></div></div></Link>
      <Link className="mode mode-dungeon" to="/dungeon"><div className="mode-card"><div className="mode-art art-dungeon"><span className="lobby-portal" /><span className="portal-light" /><img className="lobby-beetle" src="/monsters/obsidian-beetle.png" alt="" /><div className="card-art-crates"><LootSprite kind="wooden-crate" scale={2.5} /><LootSprite kind="gold-chest" scale={3} /><LootSprite kind="crystal-chest" scale={2.5} /></div></div><div className="mode-name">DUNGEON <span>↗</span></div></div></Link>
      <Link className="mode mode-shop" to="/shop"><div className="mode-card"><div className="mode-art art-shop"><img className="art-cards" src="/shop/summon-cards.png" alt="" /><span className="art-gloss" /><div className="art-coins"><span className="icon-coin" /><span className="icon-coin" /><span className="icon-coin" /></div></div><div className="mode-name">SHOP <span>↗</span></div></div></Link>
      <Link className="mode mode-fusion" to="/fusion" aria-label="Fusion">
        <div className="mode-card">
          <div className="mode-art art-fusion">
            <img className="art-fusion-image" src="/shop/fusion-altar.png" alt="Two colored crystals merging into a golden essence above a fusion altar" width="1254" height="1254" />
          </div>
          <div className="mode-name">FUSION <span>↗</span></div>
        </div>
      </Link>
      <Link className="mode mode-market" to="/market"><div className="mode-card"><div className="mode-art art-market"><div className="art-merchant" /><div className="art-pile art-pile-left" /><div className="art-pile art-pile-right" /></div><div className="mode-name">MARKET <span>↗</span></div></div></Link>
    </nav>
    <div className="lobby-extra-links"><Link className="lobby-ranking-link" to="/ranking">✦ SEASON RANKING <span>↗</span></Link><Link className="lobby-ranking-link" to="/stake">✦ STAKE <small>COMING SOON</small><span>↗</span></Link></div>
  </div>;
}
