import { useEffect, useMemo, useState, type CSSProperties, type Dispatch, type SetStateAction } from "react";
import { GEAR_BOXES, GEAR_BOX_LABELS, GEAR_LABELS, GEAR_PITY_LIMITS, GEAR_RARITIES, GEAR_RULES, GEAR_WEIGHTS, equipmentAttack, gearRarityDrawSize, type GearBox, type GearPieceDto, type GearRarity, type HeroDto, type UserDto } from "@herobits/shared";
import { api } from "../lib/api";
import { Link } from "react-router-dom";
import "./equipment.css";

const colors: Record<GearRarity, string> = { STEEL: "#a5aeb9", GREEN: "#54d3a0", BLUE: "#4b9eff", PURPLE: "#b968f1", GOLD: "#ffc858", MYTHIC: "#ff728c" };
const art = { HELM: "/ui/equipment/helm.svg", ARMOR: "/ui/equipment/armor.svg", BOOTS: "/ui/equipment/boots.svg" };
type Props = { token: string; user: UserDto | null; setUser: Dispatch<SetStateAction<UserDto | null>>; hero?: HeroDto; shopOnly?: boolean };

export function EquipmentPanel({ token, user, setUser, hero, shopOnly = false }: Props) {
  const [pieces, setPieces] = useState<GearPieceDto[] | null>(null);
  const [picked, setPicked] = useState<string[]>([]);
  const [filter, setFilter] = useState<GearRarity | "ALL">("ALL");
  const [box, setBox] = useState<GearBox>("STEEL");
  const [quantity, setQuantity] = useState<1 | 5 | 10 | 15>(1);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [confirm, setConfirm] = useState<"salvage" | "fuse" | null>(null);

  useEffect(() => { let active = true; void api.equipment(token).then((items) => { if (active) setPieces(items); }).catch((cause) => { if (active) setError(cause instanceof Error ? cause.message : "Could not load gear"); }); return () => { active = false; }; }, [token]);
  const visible = useMemo(() => (pieces ?? []).filter((piece) => filter === "ALL" || piece.rarity === filter), [pieces, filter]);
  const selected = (pieces ?? []).filter((piece) => picked.includes(piece.id));
  const fusionRarity = selected.length === 4 && selected.every((piece) => !piece.heroId && piece.rarity === selected[0].rarity) && selected[0].rarity !== "MYTHIC" ? selected[0].rarity : null;
  const salvageValue = selected.reduce((sum, piece) => sum + GEAR_RULES[piece.rarity].salvage, 0);
  const allFree = selected.every((piece) => !piece.heroId);
  const equipped = (pieces ?? []).filter((piece) => piece.heroId === hero?.id);
  const gearAttack = equipmentAttack(equipped);
  const hasSetBonus = equipped.length === 3 && equipped.every((piece) => piece.shield > 0 && piece.element === equipped[0].element);
  const boxCost = GEAR_RULES[box].price * quantity;
  const boxOdds = GEAR_RARITIES.slice(GEAR_RARITIES.indexOf(box)).map((rarity) => ({ rarity, chance: GEAR_WEIGHTS[GEAR_RARITIES.indexOf(rarity)] / gearRarityDrawSize(box) * 100 }));

  async function run(action: () => Promise<unknown>, message: string) {
    if (busy) return;
    setBusy(true); setError(""); setNotice("");
    try {
      const result = await action();
      if (result && typeof result === "object" && "user" in result && result.user) setUser(result.user as UserDto);
      setPieces(await api.equipment(token)); setPicked([]); setConfirm(null); setNotice(message);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Could not update gear"); }
    finally { setBusy(false); }
  }
  function toggle(id: string) { setPicked((ids) => ids.includes(id) ? ids.filter((item) => item !== id) : [...ids, id]); setConfirm(null); }

  return <section className="equipment-panel page-panel" aria-label="Equipment">
    <div className="equipment-head"><div><small>THE QUARTERMASTER</small><h2>{shopOnly ? "Gear boxes." : "Gear for the next hunt."}</h2><p>Three slots per hero. Fire, Storm and Frost pieces add attack while their shields hold.</p></div><span>{pieces?.length ?? 0} / 500 PIECES</span></div>
    {error && <p className="error-line" role="alert">{error}</p>}{notice && <p className="equipment-notice" role="status">{notice}</p>}
    <div className="equipment-boxes" aria-label="Gear boxes">{GEAR_BOXES.map((rarity) => <button type="button" key={rarity} className={box === rarity ? "selected" : ""} aria-pressed={box === rarity} disabled={busy} onClick={() => setBox(rarity)} style={{ "--gear-color": colors[rarity] } as CSSProperties}><img src={art[rarity === "GREEN" ? "ARMOR" : rarity === "BLUE" ? "BOOTS" : "HELM"]} alt=""/><strong>{GEAR_BOX_LABELS[rarity].toUpperCase()}</strong><small>{GEAR_RULES[rarity].price.toLocaleString("en-US")} GOLD · {rarity === "STEEL" ? "Any rarity" : GEAR_LABELS[rarity] + " or better"}</small></button>)}</div>
    <div className="equipment-open page-panel"><div><small>BOX ODDS</small><h3>{GEAR_BOX_LABELS[box]}</h3><div className="equipment-odds">{boxOdds.map(({ rarity, chance }) => <span key={rarity}><b style={{ color: colors[rarity] }}>{GEAR_LABELS[rarity]}</b><strong>{chance.toFixed(2)}%</strong></span>)}</div></div><div><small>GUARANTEED GEAR</small>{box === "STEEL" ? <><div className="equipment-pity" aria-label="Gear rarity guarantees">{(["blue", "purple", "gold"] as const).map((tier) => <div key={tier} style={{ "--gear-color": colors[tier.toUpperCase() as GearRarity] } as CSSProperties}><span>{GEAR_LABELS[tier.toUpperCase() as GearRarity].toUpperCase()} <b>{Math.min(user?.gearPity?.[tier] ?? 0, GEAR_PITY_LIMITS[tier])}/{GEAR_PITY_LIMITS[tier]}</b></span><div><i style={{ width: Math.min(100, (user?.gearPity?.[tier] ?? 0) / GEAR_PITY_LIMITS[tier] * 100) + "%" }}/></div></div>)}</div><p>The box that fills a bar brings exactly its rarity.</p></> : <p>Green and Blue boxes do not fill the guarantee bars.</p>}
      <div className="equipment-quantity" aria-label="How many boxes">{([1, 5, 10, 15] as const).map((value) => <button type="button" key={value} aria-pressed={quantity === value} className={quantity === value ? "selected" : ""} onClick={() => setQuantity(value)}>x{value}</button>)}</div><div className="equipment-total">TOTAL <strong>{boxCost.toLocaleString("en-US")} GOLD</strong></div><div className="equipment-buy"><button type="button" disabled={busy || (user?.gold ?? 0) < boxCost || (pieces?.length ?? 0) + quantity > 500} onClick={() => void run(() => api.buyEquipment(token, box, quantity, "gold", crypto.randomUUID()), `${quantity} gear ${quantity === 1 ? "box" : "boxes"} opened. Check your armory below.`)}>BUY</button><button type="button" disabled={busy || (user?.chest ?? 0) < boxCost || (pieces?.length ?? 0) + quantity > 500} onClick={() => void run(() => api.buyEquipment(token, box, quantity, "chest", crypto.randomUUID()), `${quantity} gear ${quantity === 1 ? "box" : "boxes"} opened from your chest.`)}>WITH CHEST</button></div></div></div>
    {shopOnly ? <Link className="equipment-armory-link" to="/armory">VIEW YOUR ARMORY ↗</Link> : <><div className="equipment-section-head"><div><small>YOUR ARMORY</small><h3>{hero ? hero.class + " #" + hero.id.slice(-5) : "Choose a hero above"}</h3><p>{hero ? "Equipped bonus: +" + gearAttack + " ATK · " + equipped.length + "/3 slots" + (hasSetBonus ? " · MATCHING ELEMENT +10%" : "") : "Select a hero to equip a piece."}</p></div><label>RARITY <select value={filter} onChange={(event) => setFilter(event.target.value as GearRarity | "ALL")}><option value="ALL">All gear</option>{GEAR_RARITIES.map((rarity) => <option value={rarity} key={rarity}>{GEAR_LABELS[rarity]}</option>)}</select></label></div>
    {!pieces ? <p className="equipment-empty">Loading gear…</p> : !visible.length ? <p className="equipment-empty">No pieces here yet. Open a gear box to start your set.</p> : <div className="equipment-grid">{visible.map((piece) => <article key={piece.id} className={"equipment-card" + (picked.includes(piece.id) ? " picked" : "")} style={{ "--gear-color": colors[piece.rarity] } as CSSProperties}>
      <button type="button" className="equipment-select" aria-pressed={picked.includes(piece.id)} aria-label={"Select " + piece.rarity + " " + piece.slot} onClick={() => toggle(piece.id)}>{picked.includes(piece.id) ? "✓" : "+"}</button>
      <img className="equipment-card-art" src={art[piece.slot]} alt=""/><strong>{piece.element} {piece.slot}</strong><span>{GEAR_LABELS[piece.rarity]} · +{piece.attack} ATK</span>
      <div className="equipment-shield"><small>SHIELD {piece.shield.toLocaleString("en-US")} / {piece.shieldMax.toLocaleString("en-US")}</small><div><i style={{ width: Math.round(piece.shield / piece.shieldMax * 100) + "%" }} /></div></div>
      <small className="equipment-owner">{piece.heroId ? piece.heroId === hero?.id ? "EQUIPPED TO SELECTED HERO" : "ON HERO #" + piece.heroId.slice(-5) : "FREE IN ARMORY"}</small>
      <div className="equipment-card-actions">{piece.heroId ? <button disabled={busy} onClick={() => void run(() => api.removeEquipment(token, piece.id), "Gear removed.")}>REMOVE</button> : <button disabled={busy || !hero || hero.status !== "IDLE" || piece.shield <= 0} onClick={() => hero && void run(() => api.equipEquipment(token, piece.id, hero.id), "Gear equipped.")}>EQUIP</button>}<button disabled={busy || piece.shield >= piece.shieldMax || (user?.scrap ?? 0) < GEAR_RULES[piece.rarity].repair} onClick={() => void run(() => api.repairEquipment(token, piece.id), "Gear shield restored.")}>REPAIR · {GEAR_RULES[piece.rarity].repair}</button></div>
    </article>)}</div>}
    <div className="equipment-craft"><span>{picked.length} SELECTED · {user?.scrap ?? 0} SCRAP</span><div><button disabled={busy || !picked.length || !allFree} onClick={() => { if (confirm === "salvage") void run(() => api.salvageEquipment(token, picked), picked.length + " pieces salvaged for " + salvageValue + " Scrap."); else setConfirm("salvage"); }}>{confirm === "salvage" ? "CONFIRM SALVAGE · +" + salvageValue : "SALVAGE"}</button><button disabled={busy || !fusionRarity || (user?.scrap ?? 0) < (fusionRarity ? GEAR_RULES[fusionRarity].fusion : 0)} onClick={() => { if (confirm === "fuse") void run(() => api.fuseEquipment(token, picked), "Four pieces fused into higher rarity gear."); else setConfirm("fuse"); }}>{confirm === "fuse" ? "CONFIRM FUSION · " + (fusionRarity ? GEAR_RULES[fusionRarity].fusion : 0) + " SCRAP" : "FUSE FOUR"}</button></div><small>Salvage permanently removes free pieces. Fusion consumes four free pieces of one rarity and Scrap.</small></div></>}
  </section>;
}
