import { useEffect,useState } from "react";
import { HERO_RARITIES,RARITY_INFO } from "@herobits/shared";
import { useRuntimeConfig } from "../state/RuntimeConfig";
import { useAuth } from "../state/AuthContext";
import { useSummons } from "../state/SummonContext";
import { PendingSummonPacks } from "../components/PendingSummonPacks";

export function SummonPage(){
 const {GAME,RARITY_WEIGHTS,config}=useRuntimeConfig();
 const counts=config.heroes.summonPacks;
 const {user}=useAuth();
 const {busy,purchase,error}=useSummons();
 const [count,setCount]=useState<number>(counts[0]);
 useEffect(()=>{if(!counts.includes(count))setCount(counts[0]);},[counts,count]);
 const each=GAME.SUMMON_COST,total=Math.round(each*count*100)/100;
 const canPay=(user?.gold??0)>=total;
 const totalWeight=Object.values(RARITY_WEIGHTS).reduce((sum,value)=>sum+value,0);
 return <section className="page" aria-label="SUMMON">
  <PendingSummonPacks/>
  <div className="summon-layout">
   <div className="summon-stage" aria-hidden><span className="summon-rays"/><span className="summon-deck"><img className="summon-cards" src="/shop/summon-cards.png" alt=""/><span className="art-gloss"/></span></div>
   <section className="page-panel summon-buy">
    <h2 className="page-panel-title">Summon Heroes</h2>
    <div className="seg" role="radiogroup" aria-label="How many heroes">{counts.map(n=><button key={n} type="button" className="seg-option" role="radio" aria-checked={n===count} disabled={busy} onClick={()=>setCount(n)}>x{n}</button>)}</div>
    <div className="summon-total"><span><span className="icon-coin"/>{each.toLocaleString("en-US")} each</span><strong>Total <span className="icon-coin"/>{total.toLocaleString("en-US")}</strong></div>
    <p className="page-note summon-fee">Pay with your game balance. Reveal your cards, then confirm to add the heroes to your collection.</p>
    <button type="button" className="cta cta-main cta-big" disabled={busy||!canPay} onClick={()=>void purchase("GOLD",count)}>{busy?"PROCESSING…":"BUY "+count+" "+(count===1?"CARD":"CARDS")}</button>
    {!canPay&&!error&&<p className="page-note">Not enough gold.</p>}
    <div className="odds-table" role="table" aria-label="Summon odds">
     <div className="odds-row odds-head" role="row"><span/><span>Rarity</span><span>Chance</span></div>
     {HERO_RARITIES.map(rarity=><div key={rarity} className="odds-row" role="row" style={{"--rarity":RARITY_INFO[rarity].color} as React.CSSProperties}><span className="odds-card"/><span className="odds-name">{RARITY_INFO[rarity].name}</span><strong>{(RARITY_WEIGHTS[rarity]/totalWeight*100).toFixed(2)}%</strong></div>)}
    </div>
   </section>
  </div>
 </section>;
}
