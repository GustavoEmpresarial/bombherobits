import { useSummons } from "../state/SummonContext";
export function PendingSummonPacks(){
 const {batches,loading,busy,error,open,refresh}=useSummons();
 if(!batches.length&&!loading&&!error)return null;
 return <section id="pending-summons" className="summon-pending-packs" aria-label="Pending cards">
  <div className="summon-pending-heading"><span className="page-eyebrow">YOUR CARDS</span><h2>Your pending packs</h2><p>Reveal your cards, then add the heroes to your collection.</p></div>
  {loading&&<p className="page-note">Loading your packs…</p>}
  {error&&<p className="error-line" role="alert">{error} <button type="button" onClick={()=>void refresh().catch(()=>{})}>Refresh packs</button></p>}
  <div className="summon-pending-list">{batches.map(batch=><article key={batch.id} className="summon-pending-pack"><img src="/shop/summon-cards.png" alt=""/><div><strong>{batch.count} {batch.count===1?"hero card":"hero cards"}</strong><span>{batch.source==="GOLD"?"Gold purchase":"Card redemption"} · {batch.status==="SEALED"?"Sealed pack":batch.count===1?"Card revealed":"Cards revealed"}</span><small>Saved to your account · continue anytime</small></div><button type="button" className="cta cta-main" disabled={busy} onClick={()=>open(batch)}>{batch.status==="SEALED"?"OPEN PACK":"VIEW & CLAIM"}</button></article>)}</div>
 </section>;
}
