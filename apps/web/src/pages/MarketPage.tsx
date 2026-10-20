import { Link } from 'react-router-dom';
import { PageHeading } from '../components/Page';
export function MarketPage() {
  return <section className="page" aria-label="MARKET">
    <PageHeading eyebrow="THE TRADING POST" title="Good things are on the horizon." description="A new place to find your next favorite hero." />
    <section className="market-preview page-panel">
      <div className="market-preview-art"><img src="/characters/cinder-portrait.png" alt="Cinder the fox ranger guarding the trading post" /><span className="market-seal">COMING SOON</span></div>
      <div><span className="page-eyebrow">THE NEXT CHAPTER</span><h3>A world of possibilities.<br /><em>A party like no other.</em></h3><p>The trading post is being prepared. For now, discover your heroes and get your team ready for the dungeon.</p><Link to="/dungeon" className="cta cta-main">EXPLORE YOUR HEROES <span>→</span></Link></div>
    </section>
  </section>;
}
