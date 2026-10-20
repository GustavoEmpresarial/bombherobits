import { useState, type CSSProperties, type Dispatch, type SetStateAction } from "react";
import type { DungeonSnapshot } from "@herobits/shared";
import { HuntStatus } from "./HuntStatus";
import { NavLink, Outlet, useLocation, Link } from "react-router-dom";
import { IS_DEMO, useAuth } from "../state/AuthContext";
import { HuntingRewards } from "./HuntingRewards";

const panels: Record<string, [string, string]> = {
  "/heroes": ["HEROES", "/"], "/shop": ["SHOP", "/"],
  "/shop/summon": ["SUMMON", "/shop"], "/shop/blacksmiths": ["RECOVERY HOUSES", "/shop"],
  "/shop/porter": ["PORTER", "/shop"], "/market": ["MARKET", "/"],
  "/invites": ["INVITES", "/"], "/chest": ["CHEST", "/"],
  "/withdraw": ["REWARD TRANSFER", "/chest"], "/settings": ["SETTINGS", "/"],
};
// Crop transparent source padding in the SVG viewport, keeping each icon's proportions.
const shortcuts = [
  { to: "/", image: "/ui/icon-home.png", label: "Home", size: [256,256], viewBox: "34 26 188 204" },
  { to: "/dungeon", image: "/ui/icon-dungeon.png", label: "Dungeon", size: [256,256], viewBox: "28 27 200 202" },
  { to: "/shop/summon", image: "/shop/summon-cards.png", label: "Summon", size: [724,724], viewBox: "33 37 691 630" },
  { to: "/shop/blacksmiths", image: "/shop/houses/ember-nook.png", label: "Recovery houses", size: [1312,1199], viewBox: "75 75 1160 1060" },
  { to: "/shop/porter", image: "/shop/porter.png", label: "Porter", size: [724,724], viewBox: "70 123 628 548" },
  { to: "/shop", image: "/ui/icon-shop.png", label: "Shop", size: [256,256], viewBox: "28 28 200 198" },
  { to: "/invites", image: "/ui/icon-invite.png", label: "Invites", size: [256,256], viewBox: "37 29 182 196" },
] as const;

export type DungeonLayoutContext = { setHuntSnapshot: Dispatch<SetStateAction<DungeonSnapshot | null>> };

export function Layout() {
  const [huntSnapshot, setHuntSnapshot] = useState<DungeonSnapshot | null>(null);
  const { user } = useAuth();
  const { pathname } = useLocation();
  const hunt = pathname === "/dungeon";
  const panel = panels[pathname];
  const wallet = IS_DEMO ? null : user?.wallet;
  const gold = (user?.gold ?? 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return <div className="app" data-screen={hunt ? "hunt" : pathname === "/" ? "lobby" : "panel"}>
    <header className="topbar">
      {panel || hunt ? <div className="topbar-back"><Link to={panel?.[1] ?? "/"} className="top-btn" aria-label="Back"><img className="ui-icon" src="/ui/icon-back.png" alt="" /></Link>{panel && <h1 className="topbar-title">{panel[0]}</h1>}{hunt && <HuntStatus snapshot={huntSnapshot} />}</div> : <div className="player"><div className="player-avatar"><img className="ui-icon ui-icon-avatar" src="/ui/icon-hero.png" alt="" /></div><div className="player-text"><div className="player-name">{wallet ? `${wallet.slice(0,4)}…${wallet.slice(-4)}` : user?.displayName ?? "Adventurer"}</div></div></div>}
      <div className="topbar-right">
        {IS_DEMO && <a className="top-btn demo-session-badge" href="/auth" aria-label="Exit demo" title="Demo progress is separate from the live game. Exit to the public site.">DEMO <span aria-hidden="true">↗</span></a>}
        {pathname === "/" && <div className="topbar-community" aria-label="Community and token">
          <button type="button" className="top-btn discord-btn" disabled aria-label="Discord — coming soon" title="Discord — coming soon"><span>DISCORD</span></button>
          <button type="button" className="top-btn token-buy-btn" disabled aria-label="Buy MHDG — coming soon" title="Token purchase link coming soon"><span className="icon-coin" aria-hidden="true"/><span>BUY MHDG</span><span className="token-buy-arrow" aria-hidden="true">↗</span></button>
        </div>}
        {!hunt && <Link to="/invites" className="top-btn invite-btn"><img className="ui-icon" src="/ui/icon-invite.png" alt="" /><span className="invite-label">INVITE</span></Link>}
        {hunt && <HuntingRewards amount={user?.chest ?? 0} />}
        <Link to="/chest" className={`mhdg-chip${hunt ? " hunt-balance-chip" : ""}`} aria-label="Balance and rewards"><span className="icon-coin" />{hunt ? <span className="hunt-balance-copy"><small>GAME BALANCE</small><strong>{gold}<span> MHDG</span></strong></span> : <><span className="mhdg-value">{gold}</span><small>MHDG</small></>}</Link>
        <Link to="/chest" className="top-btn chest-btn" aria-label="Open chest"><img className="ui-icon" src="/sprites/chest.png" alt="" />{(user?.mintCards ?? 0) > 0 && <span className="chest-badge">{user?.mintCards}</span>}</Link>
        <Link to="/settings" className="top-btn" aria-label="Settings"><img className="ui-icon" src="/ui/icon-gear.png" alt="" /></Link>
      </div>
    </header>
    <main className="stage"><Outlet context={{ setHuntSnapshot } satisfies DungeonLayoutContext} /></main>
    {!hunt && <nav className="game-dock" aria-label="Game shortcuts" style={{ "--dock-count": shortcuts.length } as CSSProperties}>{shortcuts.map(({to, image, label, size, viewBox}) => <NavLink key={to} to={to} end className={({isActive}) => `game-dock-btn${isActive ? " active" : ""}`} aria-label={label}><svg className="game-dock-icon" viewBox={viewBox} aria-hidden="true" focusable="false"><image href={image} width={size[0]} height={size[1]} /></svg><span>{label}</span></NavLink>)}</nav>}
  </div>;
}
