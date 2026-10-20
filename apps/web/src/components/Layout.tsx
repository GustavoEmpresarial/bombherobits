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
// One art family keeps the HUD and shortcut dock visually consistent.
const shortcuts = [
  { to: "/", image: "/ui/v2/home.webp", label: "Home", caption: "HOME" },
  { to: "/dungeon", image: "/ui/v2/dungeon.webp", label: "Dungeon", caption: "DUNGEON" },
  { to: "/shop/summon", image: "/ui/v2/summon.webp", label: "Summon", caption: "SUMMON" },
  { to: "/shop/blacksmiths", image: "/ui/v2/houses.webp", label: "Recovery houses", caption: "HOUSES" },
  { to: "/shop/porter", image: "/ui/v2/porter.webp", label: "Porter", caption: "PORTER" },
  { to: "/shop", image: "/ui/v2/shop.webp", label: "Shop", caption: "SHOP" },
  { to: "/invites", image: "/ui/v2/invite.webp", label: "Invites", caption: "INVITES" },
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
        {IS_DEMO && <a className="top-btn demo-session-badge" href="/auth" aria-label="Exit demo" title="Demo progress is separate from the live game. Exit to the public site."><i aria-hidden="true" />DEMO <span aria-hidden="true">↗</span></a>}
        {pathname === "/" && <div className="topbar-community" aria-label="Community and token">
          <button type="button" className="top-btn discord-btn" disabled aria-label="Discord — coming soon" title="Discord — coming soon"><span>DISCORD</span></button>
          <button type="button" className="top-btn token-buy-btn" disabled aria-label="Buy MHDG — coming soon" title="Token purchase link coming soon"><img className="hud-coin" src="/ui/v2/coin.webp" alt=""/><span>BUY MHDG</span><span className="token-buy-arrow" aria-hidden="true">↗</span></button>
        </div>}
        {!hunt && <Link to="/invites" className="top-btn invite-btn"><img className="hud-art" src="/ui/v2/invite.webp" alt="" /><span className="invite-label">INVITE</span></Link>}
        {hunt && <HuntingRewards amount={user?.chest ?? 0} />}
        <Link to="/chest" className={`mhdg-chip${hunt ? " hunt-balance-chip" : ""}`} aria-label="Balance and rewards"><img className="hud-coin" src="/ui/v2/coin.webp" alt="" /><span className={`header-balance-copy${hunt ? " hunt-balance-copy" : ""}`}><small>GAME BALANCE</small><strong>{gold}<span>MHDG</span></strong></span></Link>
        <Link to="/chest" className="top-btn chest-btn hud-art-button" aria-label="Open chest" title="Chest and hero cards"><img className="hud-art" src="/ui/v2/chest.webp" alt="" />{(user?.mintCards ?? 0) > 0 && <span className="chest-badge" aria-label={`${user?.mintCards} hero cards`}>{(user?.mintCards ?? 0) > 99 ? "99+" : user?.mintCards}</span>}</Link>
        <Link to="/settings" className="top-btn hud-art-button settings-btn" aria-label="Settings" title="Settings"><img className="hud-art" src="/ui/v2/settings.webp" alt="" /></Link>
      </div>
    </header>
    <main className="stage"><Outlet context={{ setHuntSnapshot } satisfies DungeonLayoutContext} /></main>
    {!hunt && <nav className="game-dock" aria-label="Game shortcuts" style={{ "--dock-count": shortcuts.length } as CSSProperties}><div className="game-dock-track">{shortcuts.map(({to, image, label, caption}) => <NavLink key={to} to={to} end className={({isActive}) => `game-dock-btn${isActive ? " active" : ""}`} aria-label={label} title={label}><img className="game-dock-art" src={image} alt="" draggable="false"/><small className="game-dock-label">{caption}</small></NavLink>)}</div></nav>}
  </div>;
}
