import { useEffect, useMemo, useState, type FormEvent } from "react";
import type { HeroDto } from "@herobits/shared";
import { PageHeading, PageState } from "../components/Page";
import { GameSprite } from "../components/GameSprite";
import { api } from "../lib/api";
import { HERO_ART } from "../lib/characters";
import { useWorld } from "./useWorld";
import "./market.css";

type Kind = "HERO" | "BLACKSMITH" | "PORTER";
type Option = { kind: Kind; id: string; label: string };
const money = (value: number) => value.toLocaleString("en-US", { maximumFractionDigits: 2 });

export function MarketPage() {
  const { token, world, error, busy, run } = useWorld();
  const [heroes, setHeroes] = useState<HeroDto[]>([]);
  const [inventoryError, setInventoryError] = useState("");
  const [tab, setTab] = useState<"browse" | "sell" | "mine">("browse");
  const [kind, setKind] = useState<Kind>("HERO");
  const [refId, setRefId] = useState("");
  const [price, setPrice] = useState("");

  useEffect(() => {
    if (!token) return;
    let active = true;
    void api.heroes(token).then(items => { if (active) setHeroes(items); }).catch(cause => {
      if (active) setInventoryError(cause instanceof Error ? cause.message : "Could not load inventory");
    });
    return () => { active = false; };
  }, [token]);

  const options = useMemo<Option[]>(() => {
    if (!world) return [];
    const listed = new Set(world.myListings.map(item => `${item.kind}:${item.refId}`));
    return [
      ...heroes.filter(hero => hero.status === "IDLE" && !listed.has(`HERO:${hero.id}`)).map(hero => ({
        kind: "HERO" as const, id: hero.id, label: `${hero.rarity.replaceAll("_", " ")} ${HERO_ART[hero.class].name} · ATK ${hero.atk} · ${hero.id.slice(-6)}`,
      })),
      ...world.blacksmiths.filter(house => !house.inService && !listed.has(`BLACKSMITH:${house.id}`)).map(house => ({
        kind: "BLACKSMITH" as const, id: house.id, label: `${house.name} · Tier ${house.tier}`,
      })),
      ...(!world.porterOn ? world.porterItems.filter(porter => !listed.has(`PORTER:${porter.id}`)).map(porter => ({
        kind: "PORTER" as const, id: porter.id, label: `Porter · ${porter.id.slice(-6)}`,
      })) : []),
    ];
  }, [heroes, world]);

  if (!world || !token) return <PageState error={error} retry={() => window.location.reload()} />;
  const available = options.filter(item => item.kind === kind);
  const amount = Number(price);
  const valid = price !== "" && Number.isFinite(amount) && amount >= 0.01 && amount <= 1_000_000_000 && Math.round(amount * 100) / 100 === amount;
  const refreshHeroes = () => void api.heroes(token).then(setHeroes).catch(cause => setInventoryError(cause instanceof Error ? cause.message : "Could not refresh inventory"));
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!refId || !valid) return;
    const listed = await run(() => api.marketList(token, { kind, refId, price: amount }));
    if (!listed) return;
    refreshHeroes();
    setRefId("");
    setPrice("");
  };

  return <section className="page trading-post" aria-label="MARKET">
    <PageHeading eyebrow="THE TRADING POST" title="Find your next spark." description="Trade heroes, recovery houses and porters with other adventurers using your in-game gold." />
    <div className="market-topline page-panel">
      <div><span className="page-eyebrow">YOUR BALANCE</span><strong>{money(world.user.gold)} <small>gold</small></strong></div>
      <div><span className="page-eyebrow">TRADING FEE</span><strong>{Math.round(world.economy.MARKET_FEE * 100)}% <small>paid by seller</small></strong></div>
      <div><span className="page-eyebrow">OPEN OFFERS</span><strong>{world.listings.length}</strong></div>
    </div>
    <div className="market-tabs" role="tablist" aria-label="Trading post">
      {([["browse", "BROWSE"], ["sell", "SELL"], ["mine", `MY LISTINGS · ${world.myListings.length}`]] as const).map(([value, label]) =>
        <button key={value} role="tab" aria-selected={tab === value} className={tab === value ? "selected" : ""} type="button" onClick={() => setTab(value)}>{label}</button>)}
    </div>
    {error && <p className="error-line" role="alert">{error}</p>}
    {inventoryError && <p className="error-line" role="alert">{inventoryError}</p>}

    {tab === "browse" && <div className="market-list" aria-busy={busy}>
      {world.listings.filter(item => !item.mine).map(item => <article className="market-offer page-panel" key={item.id}>
        <span className="market-offer-icon" aria-hidden="true">{item.heroClass ? <GameSprite kind={HERO_ART[item.heroClass].id} scale={1.6} /> : item.kind === "BLACKSMITH" ? "⌂" : "◇"}</span>
        <div className="market-offer-copy"><small>{item.kind.replace("BLACKSMITH", "RECOVERY HOUSE")}</small><h3>{item.title}</h3><span>Sold by {item.seller}</span></div>
        <strong className="market-offer-price">{money(item.price)} <small>gold</small></strong>
        <button className="cta cta-main" type="button" disabled={busy || world.user.gold < item.price} onClick={() => { void run(() => api.marketBuy(token, item.id)).then(refreshHeroes); }}>{world.user.gold < item.price ? "NEED GOLD" : "BUY"}</button>
      </article>)}
      {!world.listings.some(item => !item.mine) && <div className="market-empty page-panel"><h3>No offers yet</h3><p>The trading post is quiet. Check back later or list an item.</p><button className="cta cta-main" type="button" onClick={() => setTab("sell")}>CREATE A LISTING</button></div>}
    </div>}

    {tab === "sell" && <form className="market-sell page-panel" onSubmit={event => void submit(event)}>
      <div><span className="page-eyebrow">MAKE AN OFFER</span><h3>Pass a spark to another hero.</h3><p>Working heroes must rest first. Active houses and porters must be turned off before sale.</p></div>
      <label>Item type<select value={kind} onChange={event => { setKind(event.target.value as Kind); setRefId(""); }}><option value="HERO">Hero</option><option value="BLACKSMITH">Recovery house</option><option value="PORTER">Porter</option></select></label>
      <label>Item<select value={refId} required onChange={event => setRefId(event.target.value)}><option value="">Choose an item…</option>{available.map(item => <option value={item.id} key={item.id}>{item.label}</option>)}</select></label>
      {!available.length && <p className="market-help">No available items of this type.</p>}
      <label>Asking price in gold<input type="number" min="0.01" max="1000000000" step="0.01" inputMode="decimal" value={price} required onChange={event => setPrice(event.target.value)} placeholder="100.00" /></label>
      {valid && <p className="market-help">You receive {money(Math.round(amount * (1 - world.economy.MARKET_FEE) * 100) / 100)} gold after the trading fee.</p>}
      <button className="cta cta-main" type="submit" disabled={busy || !refId || !valid}>{busy ? "LISTING…" : "LIST ITEM"}</button>
    </form>}

    {tab === "mine" && <div className="market-list" aria-busy={busy}>
      {world.myListings.map(item => <article className="market-offer page-panel" key={item.id}>
        <span className="market-offer-icon" aria-hidden="true">{item.heroClass ? <GameSprite kind={HERO_ART[item.heroClass].id} scale={1.6} /> : "◇"}</span>
        <div className="market-offer-copy"><small>{item.kind.replace("BLACKSMITH", "RECOVERY HOUSE")}</small><h3>{item.title}</h3><span>Open listing</span></div>
        <strong className="market-offer-price">{money(item.price)} <small>gold</small></strong>
        <button className="cta-alt" type="button" disabled={busy} onClick={() => { void run(() => api.marketCancel(token, item.id)).then(refreshHeroes); }}>CANCEL</button>
      </article>)}
      {!world.myListings.length && <div className="market-empty page-panel"><h3>No listings of your own</h3><p>Your items for sale will appear here.</p><button className="cta cta-main" type="button" onClick={() => setTab("sell")}>SELL AN ITEM</button></div>}
    </div>}
  </section>;
}
