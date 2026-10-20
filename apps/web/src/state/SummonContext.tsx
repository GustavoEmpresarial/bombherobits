import { createContext,useCallback,useContext,useEffect,useRef,useState,type ReactNode,type CSSProperties } from "react";
import { createPortal } from "react-dom";
import { Link } from "react-router-dom";
import { RARITY_INFO,type SummonBatchDto,type SummonPurchaseDto } from "@herobits/shared";
import { useAuth } from "./AuthContext";
import { PendingSummonTracker,confirmationHold } from "./summon-flow";
import { api } from "../lib/api";
import { HERO_ART } from "../lib/characters";
import "../components/summon-reveal.css";

type Source="GOLD"|"CARDS";
type Value={batches:SummonBatchDto[];loading:boolean;busy:boolean;error:string;purchase:(source:Source,count:number)=>Promise<void>;open:(batch:SummonBatchDto)=>void;refresh:()=>Promise<void>};
const Context=createContext<Value|null>(null);
export function useSummons(){const value=useContext(Context);if(!value)throw new Error("useSummons outside SummonProvider");return value;}

export function SummonProvider({children}:{children:ReactNode}){
 const {token,user,setUser}=useAuth();
 const [batches,setBatches]=useState<SummonBatchDto[]>([]);
 const [loading,setLoading]=useState(false),[busy,setBusy]=useState(false),[error,setError]=useState("");
 const [active,setActive]=useState<SummonBatchDto|null>(null),[flipped,setFlipped]=useState<number[]>([]),[animating,setAnimating]=useState(false);
 const [stagger,setStagger]=useState(false);
 const [confirmed,setConfirmed]=useState(false);
 const tracker=useRef(new PendingSummonTracker());
 const [confirming,setConfirming]=useState<number|null>(null);
 const lock=useRef(false),tokenRef=useRef(token),timer=useRef<number|undefined>(undefined);
 tokenRef.current=token;
 const storageKey="herobits-summon-request-"+(user?.id??"loading");
 const refresh=useCallback(async()=>{
  if(!token)return;
  const current=tracker.current,stamp=current.beginRefresh();
  const rows=await api.pendingSummons(token);
  if(tokenRef.current!==token||tracker.current!==current||!current.accepts(stamp))return;
  setBatches(current.pending(rows));
  try{const previous=JSON.parse(sessionStorage.getItem(storageKey)||"null");if(previous&&rows.some(batch=>batch.requestId===previous.requestId))sessionStorage.removeItem(storageKey);}catch{}
 },[token,storageKey]);
 useEffect(()=>{
  let cancelled=false;tracker.current=new PendingSummonTracker();lock.current=false;window.clearTimeout(timer.current);setBusy(false);setAnimating(false);setLoading(false);setBatches([]);setActive(null);setConfirming(null);setFlipped([]);setError("");
  if(!token)return;
  setLoading(true);
  void refresh().catch(e=>{if(!cancelled)setError(e instanceof Error?e.message:"Could not load your pending cards. Please try again.");}).finally(()=>{if(!cancelled)setLoading(false);});
  const interval=window.setInterval(()=>{if(!document.hidden&&!lock.current)void refresh().catch(()=>{});},10000);
  return()=>{cancelled=true;window.clearInterval(interval);};
 },[token,refresh]);
 useEffect(()=>()=>window.clearTimeout(timer.current),[]);
 async function purchase(source:Source,count:number){
  if(!token||!user||lock.current)return;
  lock.current=true;tracker.current.invalidate();setBusy(true);setError("");setConfirmed(false);setConfirming(count);
  const startedAt=performance.now();
  try{
   let intent:{source:Source;count:number;requestId:string}|null=null;
   try{intent=JSON.parse(sessionStorage.getItem(storageKey)||"null");}catch{}
   if(intent&&(intent.source!==source||intent.count!==count))throw new Error("Check your pending packs or retry your previous purchase before buying a different pack.");
   intent??={source,count,requestId:crypto.randomUUID()};
   sessionStorage.setItem(storageKey,JSON.stringify(intent));
   const result:SummonPurchaseDto=source==="GOLD"?await api.summon(token,count,intent.requestId):await api.openChest(token,count,intent.requestId);
   if(tokenRef.current!==token)return;
   setConfirmed(true);
   await new Promise<void>(resolve=>window.setTimeout(resolve,confirmationHold(startedAt,performance.now(),window.matchMedia("(prefers-reduced-motion: reduce)").matches)));
   if(tokenRef.current!==token)return;
   tracker.current.invalidate();
   sessionStorage.removeItem(storageKey);setUser(result.user);
   setBatches(rows=>tracker.current.pending([...rows.filter(row=>row.id!==result.batch.id),result.batch]));
   setActive(result.batch);setFlipped(result.batch.status==="CLAIMED"?Array.from({length:result.batch.count},(_,i)=>i):[]);setAnimating(false);setConfirming(null);
  }catch(e){
   if(tokenRef.current!==token)return;
   if(typeof (e as {statusCode?:number}).statusCode==="number"&&(e as {statusCode:number}).statusCode<500)sessionStorage.removeItem(storageKey);
   setError(e instanceof Error?e.message:"Could not buy the pack. Please try again.");
   await refresh().catch(()=>{});
  }finally{if(tokenRef.current===token){lock.current=false;setBusy(false);setConfirming(null);}}
 }
 function close(){if(lock.current)return;window.clearTimeout(timer.current);setActive(null);setAnimating(false);setError("");}
 function open(batch:SummonBatchDto){
  if(!token||lock.current)return;
  window.clearTimeout(timer.current);setError("");setActive(batch);setFlipped(batch.status==="CLAIMED"?Array.from({length:batch.count},(_,i)=>i):[]);setAnimating(false);
 }
 async function reveal(index?:number){
  if(!token||!active||lock.current||animating)return;
  const batch=active;
  lock.current=true;tracker.current.invalidate();setBusy(true);setError("");
  try{
   const result=batch.status==="SEALED"?await api.revealSummon(token,batch.id):batch;
   if(tokenRef.current!==token)return;
   tracker.current.invalidate();setActive(result);setBatches(rows=>tracker.current.pending(rows.map(row=>row.id===result.id?result:row)));
   setStagger(index===undefined);
   setFlipped(previous=>index===undefined?Array.from({length:result.count},(_,i)=>i):[...new Set([...previous,index])]);
   setAnimating(true);
   const duration=window.matchMedia("(prefers-reduced-motion: reduce)").matches?0:720+(index===undefined?Math.min(batch.count-1,12)*65:0);
   timer.current=window.setTimeout(()=>setAnimating(false),duration);
  }catch(e){if(tokenRef.current===token)setError(e instanceof Error?e.message:"Could not reveal your cards. Please try again.");}
  finally{if(tokenRef.current===token){lock.current=false;setBusy(false);}}
 }
 async function claim(){
  if(!token||!active||active.status!=="REVEALED"||flipped.length!==active.count||animating||lock.current)return;
  lock.current=true;tracker.current.invalidate();setBusy(true);setError("");
  try{
   const result=await api.claimSummon(token,active.id);if(tokenRef.current!==token)return;
   tracker.current.markClaimed(result.batchId);
   setUser(result.user);setBatches(rows=>tracker.current.pending(rows));setActive(batch=>batch?{...batch,status:"CLAIMED"}:batch);
  }catch(e){if(tokenRef.current===token)setError(e instanceof Error?e.message:"Could not add the heroes to your collection. Please try again.");}
  finally{if(tokenRef.current===token){lock.current=false;setBusy(false);}}
 }
 return <Context.Provider value={{batches,loading,busy,error,purchase,open:batch=>void open(batch),refresh}}>
  {children}
  {confirming!==null&&createPortal(<ConfirmationDialog count={confirming} confirmed={confirmed}/>,document.body)}
  {active&&createPortal(<RevealDialog batch={active} busy={busy} animating={animating} stagger={stagger} flipped={flipped} error={error} close={close} claim={()=>void claim()} reveal={index=>void reveal(index)}/>,document.body)}
 </Context.Provider>;
}

function RevealDialog({batch,busy,animating,stagger,flipped,error,close,claim,reveal}:{batch:SummonBatchDto;busy:boolean;animating:boolean;stagger:boolean;flipped:number[];error:string;close:()=>void;claim:()=>void;reveal:(index?:number)=>void}){
 const dialog=useRef<HTMLDivElement>(null),closeButton=useRef<HTMLButtonElement>(null);
 const closeRef=useRef(close);closeRef.current=close;
 useEffect(()=>{
  const previous=document.activeElement as HTMLElement|null,overflow=document.body.style.overflow;
  document.body.style.overflow="hidden";closeButton.current?.focus();
  function key(event:KeyboardEvent){
   if(event.key==="Escape"){event.preventDefault();closeRef.current();}
   if(event.key==="Tab"){
    const items=Array.from(dialog.current?.querySelectorAll<HTMLElement>('button:not([disabled]),a[href]')??[]);
    const first=items[0],last=items.at(-1);
    if(event.shiftKey&&document.activeElement===first){event.preventDefault();last?.focus();}
    else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first?.focus();}
   }
  }
  document.addEventListener("keydown",key);
  return()=>{document.body.style.overflow=overflow;document.removeEventListener("keydown",key);if(previous?.isConnected)previous.focus();};
 },[]);
 const delivered=batch.status==="CLAIMED";
 const single=batch.count===1;
 const allRevealed=flipped.length===batch.count;
 return <div className="summon-reveal-overlay" onClick={event=>{if(event.target===event.currentTarget)close();}}>
  <div className="summon-reveal-dialog" role="dialog" aria-modal="true" aria-labelledby="reveal-title" ref={dialog}>
   <header className="summon-reveal-heading"><div><span className="page-eyebrow">✦ SUMMON CONFIRMED</span><h2 id="reveal-title">{delivered?(single?"Hero added!":"Heroes added!"):batch.count+(single?" hero card awaits":" hero cards await")}</h2><p aria-live="polite">{delivered?batch.count+(single?" hero added to your collection.":" heroes added to your collection."):busy?"Preparing your cards…":animating?"The vault reveals your heroes…":allRevealed?"Your party is ready. Add your heroes to the collection.":"Tap a card to discover your hero, or reveal them all."}</p></div><button ref={closeButton} type="button" className="reveal-close" aria-label="Close card reveal" disabled={busy} onClick={close}>×</button></header>
   <div className="reveal-progress"><span role="status">{flipped.length} / {batch.count} REVEALED</span><div><i style={{width:(flipped.length/batch.count*100)+"%"}}/></div></div>
   <div className="summon-reveal-grid" aria-label="Hero cards">
    {Array.from({length:batch.count},(_,index)=>{
     const shown=flipped.includes(index);
     const card=batch.cards?.[index],art=card?HERO_ART[card.class]:null,rarity=card?RARITY_INFO[card.rarity]:null;
     return <button type="button" key={index} className="summon-reveal-card" disabled={shown||busy||animating} onClick={()=>reveal(index)} data-revealed={shown&&Boolean(card)} style={{"--reveal-rarity":rarity?.color??"#bca5ee","--flip-delay":(stagger?Math.min(index,12)*65:0)+"ms"} as CSSProperties} aria-label={card&&shown?rarity!.name+" "+art!.name:"Reveal card "+(index+1)}>
      <div className="summon-reveal-flipper">
       <div className="summon-reveal-back" aria-hidden="true"><span className="reveal-back-mark">✦</span><img src="/shop/summon-cards.png" alt=""/><span>HERO BITS</span><small>#{String(index+1).padStart(2,"0")} · TAP TO REVEAL</small></div>
       <div className="summon-reveal-front" aria-hidden={!shown}>
        {card&&art&&rarity&&<><span className="reveal-rarity">{rarity.name}</span><div className="reveal-portrait"><img src={"/characters/"+art.id+"-portrait.png"} alt=""/></div><h3>{art.name}</h3><p>{art.role} · LV 1</p><div className="reveal-stats"><span><small>ATK</small><strong>{card.atk}</strong></span><span><small>SPD</small><strong>{card.spd}</strong></span><span><small>STA</small><strong>{card.maxStamina}</strong></span></div><span className="reveal-card-number">#{String(index+1).padStart(2,"0")}</span></>}
       </div>
      </div>
     </button>;
    })}
   </div>
   <footer className="summon-reveal-footer">
    {error&&<p className="error-line" role="alert">{error}</p>}
    <p>{delivered?"Your collection is up to date.":allRevealed?"Confirm below to add your heroes to the collection.":"Your pack is saved. You can return to it anytime."}</p>
    <div>{delivered?<><button className="cta cta-alt" type="button" onClick={close}>CLOSE</button><Link className="cta cta-main" to="/dungeon" onClick={close}>VIEW HEROES →</Link></>:!allRevealed?<button className="cta cta-main" type="button" disabled={busy||animating} onClick={()=>reveal()}>{busy?"PREPARING CARDS…":animating?"REVEALING…":batch.count-flipped.length===1?"REVEAL CARD":"REVEAL ALL "+(batch.count-flipped.length)+" CARDS"}</button>:<button className="cta cta-main" type="button" disabled={busy||animating} onClick={claim}>{busy?"ADDING TO COLLECTION…":animating?"REVEALING…":"ADD TO COLLECTION"}</button>}</div>
   </footer>
  </div>
 </div>;
}

function ConfirmationDialog({count,confirmed}:{count:number;confirmed:boolean}){
 const root=useRef<HTMLDivElement>(null);
 useEffect(()=>{
  const previous=document.activeElement as HTMLElement|null,overflow=document.body.style.overflow;
  document.body.style.overflow="hidden";root.current?.focus();
  const trap=(event:KeyboardEvent)=>{if(event.key==="Tab"||event.key==="Escape"){event.preventDefault();root.current?.focus();}};
  document.addEventListener("keydown",trap);
  return()=>{document.body.style.overflow=overflow;document.removeEventListener("keydown",trap);if(previous?.isConnected)previous.focus();};
 },[]);
 return <div className="summon-reveal-overlay"><div ref={root} tabIndex={-1} className="summon-confirmation" data-confirmed={confirmed} role="dialog" aria-modal="true" aria-labelledby="summon-confirm-title" aria-describedby="summon-confirm-note" aria-busy={!confirmed}><div className="summon-seal" aria-hidden="true"><span>{confirmed?"✓":"✦"}</span><i/><i/></div><span className="page-eyebrow">THE SUMMONING VAULT</span><h2 id="summon-confirm-title">{confirmed?"Summon confirmed!":"Confirming your summon"}</h2><p id="summon-confirm-note">{confirmed?"Secured ":"Securing "}{count} {count===1?"hero card":"hero cards"} with your game balance.</p><div className="summon-confirm-track" aria-hidden="true"><span/></div><p role="status">{confirmed?"Opening the vault. Your cards are ready…":"Waiting for server confirmation…"}</p><small>Your cards will appear automatically. Keep this window open.</small></div></div>;
}
