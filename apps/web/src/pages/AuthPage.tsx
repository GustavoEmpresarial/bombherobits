import { AnimatedDungeon } from "../components/AnimatedDungeon";
import { BrandWordmark } from "../components/BrandWordmark";
import "./auth-landing.css";
import { HeroCarousel } from "../components/HeroCarousel";
import { CreatorProgram } from "../components/CreatorProgram";
import { useState, type CSSProperties } from "react";
import { CommunityButton, MarketingSections, useMarketing } from "../components/MarketingGateway";
import { HERO_ART, LOOT_ART } from "../lib/characters";

export function AuthPage() {
  const [menuOpen,setMenuOpen]=useState(false);
  const marketing = useMarketing();

  return (
    <div className="title-screen vault-landing">
      <a className="vault-skip" href="#whitelist">Skip to whitelist</a>
      <header className="vault-nav miner-nav" onKeyDown={event=>{if(event.key==="Escape"&&menuOpen){setMenuOpen(false);document.getElementById("vault-menu-toggle")?.focus();}}}>
        <a className="vault-brand" href="#top" aria-label="Bomb Hero Bits home"><BrandWordmark /></a>
        <button id="vault-menu-toggle" type="button" className="vault-menu" aria-expanded={menuOpen} aria-controls="vault-navigation" onClick={()=>setMenuOpen(value=>!value)}>{menuOpen?"CLOSE ✕":"MENU ☰"}</button>
        <nav id="vault-navigation" aria-label="Explore Bomb Miner" data-open={menuOpen}>
          {[['/whitepaper','WHITEPAPER'],['#party','HEROES'],['#token','TOKEN'],['#creators','CREATORS']].map(([href,label])=><a key={href} href={href} onClick={()=>setMenuOpen(false)}>{label}</a>)}
        </nav>
        <div className="miner-languages" aria-label="Language"><span aria-current="true">EN</span><button disabled title="Portuguese translation coming soon">BR</button><button disabled title="Filipino translation coming soon">PH</button></div>
        <CommunityButton kind="Discord" url={marketing.discordUrl}/>
        <a className="vault-nav-play" href="#whitelist" onClick={()=>setMenuOpen(false)}>EARLY ACCESS <span>↗</span></a>
      </header>
      <main>
        <section className="vault-hero miner-hero" id="top" aria-labelledby="title-heading">
          <img className="vault-backdrop" src="/art/vault-keyart.png" alt="" fetchPriority="high" width="1672" height="941" />
          <div className="vault-shade" aria-hidden="true" />
          <div className="vault-motes" aria-hidden="true">{Array.from({length:12},(_,i)=><i key={i} style={{'--i':i} as CSSProperties}/>)}</div>
          <div className="vault-hero-content">
            <span className="miner-network"><i/> SOLANA · PUMP.FUN <small>PLANNED LAUNCH</small></span>
            <h1 id="title-heading"><BrandWordmark /></h1>
            <p className="vault-tagline">Drop bombs. Crack chests.<br/><em>Farm $BMINER.</em></p>
            <p className="miner-hero-note">The game is not open yet. Whitelist is for early access.<br/>$BMINER and token farming are planned. No token is live yet.</p>

            <div className="vault-gate" id="gate" tabIndex={-1}>
              <div className="vault-hero-actions">
                <a className="vault-button vault-button-gold" href="#whitelist">JOIN THE WHITELIST <span>→</span></a>
                <a className="vault-button vault-button-outline" href="/whitepaper">READ WHITEPAPER <span>↗</span></a>
              </div>
              <div className="miner-hero-community"><CommunityButton kind="Discord" url={marketing.discordUrl}/><CommunityButton kind="X" url={marketing.xUrl}/><a className="miner-whitelist-link" href="#whitelist">WHITELIST ↓</a></div>
              <p className="vault-wallet-note">Early access is coming soon. Whitelist approval is required to play.</p>
            </div>
          </div>
          <div className="vault-hero-party" aria-hidden="true">{Object.values(HERO_ART).map(hero=><div key={hero.id} style={{'--hero-glow':hero.color} as CSSProperties}><span className="vault-idle-sprite" style={{backgroundImage:`url(/characters/${hero.id}-idle.png)`}}/><span>{hero.name}</span></div>)}</div>
          <a className="vault-scroll" href="#gameplay" aria-label="Discover the game">SCROLL TO DISCOVER <span>↓</span></a>
          <span className="vault-chapter" aria-hidden="true">CHAPTER 01 <i>✦</i> THE FORGOTTEN VAULT</span>
        </section>
        <div className="vault-feature-strip"><span><img src="/ui/icon-hero.png" alt=""/><b>03</b> ORIGINAL HEROES</span><i>✦</i><span><img src="/loot/gold-chest.png" alt=""/><b>05</b> TREASURE TYPES</span><i>✦</i><span><img src="/ui/icon-dungeon.png" alt=""/> YOUR PARTY. YOUR STRATEGY.</span></div>
        <section className="vault-section vault-gameplay" id="gameplay" aria-labelledby="gameplay-heading">
          <div className="vault-section-heading"><span className="vault-eyebrow">THE HUNT</span><h2 id="gameplay-heading">Small party.<br/><em>Big possibilities.</em></h2><p>A dungeon full of treasure. A team with a mind of its own.<br/>You build the party. Your heroes take it from there.</p></div>
          <AnimatedDungeon/>

          <div className="vault-hunt-features">{[['01','Build your party','Collect heroes, discover their strengths and choose who enters the dungeon.'],['02','Let them hunt','Your heroes move and attack automatically. Keep an eye on their stamina.'],['03','Bring it home','Break open treasure containers, collect rewards and prepare for the next wave.']].map(([n,title,description])=><article key={n}><span>{n}</span><h3>{title}</h3><p>{description}</p></article>)}</div>
        </section>
        <HeroCarousel/>
        <section className="vault-section vault-treasures" id="treasures" aria-labelledby="treasures-heading">
          <div className="vault-section-heading"><span className="vault-eyebrow">BENEATH THE SURFACE</span><h2 id="treasures-heading">Every chest.<br/><em>A new possibility.</em></h2><p>From humble wooden crates to ancient vaults.<br/>Send your heroes to discover what lies inside.</p></div>
          <div className="vault-loot-grid">{LOOT_ART.map((container,index)=><article key={container.id} style={{'--loot-color':['#ad8760','#9dabb8','#f8c566','#64dfe8','#bc91ff'][index]} as CSSProperties}><span className="vault-loot-number">0{index+1} <i>✦</i></span><div><img src={`/loot/${container.id}-portrait.png`} alt="" width="256" height="256" loading="lazy"/></div><small>{container.material}</small><h3>{container.name}</h3></article>)}</div>
        </section>
        <section className="vault-section vault-guide" id="field-guide" aria-labelledby="guide-heading">
          <div className="vault-section-heading"><span className="vault-eyebrow">YOUR FIRST ADVENTURE</span><h2 id="guide-heading">The adventure is coming.<br/><em>Get ready for early access.</em></h2></div>
          <div className="vault-guide-grid">{[['/shop/summon-cards.png','01','Summon your heroes','Choose a pack, reveal your cards and add your new heroes to the collection.'],['/ui/icon-dungeon.png','02','Enter the dungeon','Deploy your party. Your heroes find their way to the next treasure.'],['/shop/forge.png','03','Rest. Recover. Repeat.','Let your heroes rest to restore stamina. A blacksmith helps them recover faster.']].map(([art,n,title,description])=><article key={n}><img src={art} alt="" loading="lazy"/><span>{n}</span><h3>{title}</h3><p>{description}</p></article>)}</div>
        </section>
        <section className="vault-section vault-faq" aria-labelledby="faq-heading"><div className="vault-section-heading"><span className="vault-eyebrow">BEFORE YOU ENTER</span><h2 id="faq-heading">A few things to know.</h2></div><div>{[['How do I get early access?','The game is not open to the public. Apply through the whitelist when applications open. Approved players will receive instructions for the early-access phase.'],['Do I control every attack?','Your heroes move and attack automatically in the dungeon. You decide who hunts and who rests.'],['What happens when stamina runs out?','Heroes need to rest before they can keep hunting. Stamina recovers automatically while resting, and a blacksmith can speed up recovery.'],['Does applying grant immediate access?','No. The whitelist is an application for early access, not immediate access to the game. The team reviews applications and announces when approved players can enter.']].map(([question,answer])=><details key={question}><summary>{question}<span aria-hidden="true">+</span></summary><p>{answer}</p></details>)}</div></section>
        <MarketingSections config={marketing}/>
        <CreatorProgram/>
        <section className="vault-last-call"><span className="vault-eyebrow">YOUR STORY STARTS AT THE GATE</span><h2>Be first in line<br/><em>for the adventure.</em></h2><a className="vault-button vault-button-gold" href="#whitelist">EARLY ACCESS WHITELIST <span>→</span></a><p>The game is coming soon. Access will be limited to approved players.</p></section>
      </main>
      <footer className="vault-footer"><a href="#top" aria-label="Bomb Hero Bits home"><BrandWordmark/></a><nav aria-label="Footer"><a href="#creators">CREATOR PROGRAM</a><a href="#gameplay">THE HUNT</a><a href="#party">HEROES</a><a href="#field-guide">HOW TO PLAY</a></nav><small>© {new Date().getFullYear()} BOMB MINER</small></footer>
    </div>
  );
}
