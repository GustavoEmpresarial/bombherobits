import type { CSSProperties } from "react";
import { arenaTheme, type DungeonSnapshot } from "@herobits/shared";
import "./hunt-status.css";

export function HuntStatus({ snapshot }: { snapshot: DungeonSnapshot | null }) {
  const theme = arenaTheme(snapshot?.wave ?? 1);
  const total = snapshot?.waveTotal ?? 0;
  const remaining = snapshot?.targets.length ?? 0;
  const cleared = total > 0 ? Math.round(Math.max(0, Math.min(1, 1 - remaining / total)) * 100) : 0;
  return (
    <div className="hunt-topbar-status" aria-label="Dungeon progress" style={{ '--arena-accent': theme.accent } as CSSProperties}>
      <div className="hunt-location"><small><i aria-hidden />TREASURE HUNT</small><strong>{theme.name}</strong></div>
      <div className="hunt-topbar-stat hunt-wave"><small>WAVE</small><strong>{snapshot?.wave ?? '—'}</strong></div>
      <div className="hunt-topbar-stat hunt-crates">
        <img src="/sprites/chest.png" alt="" />
        <div className="hunt-crates-copy"><small>CHESTS LEFT</small><strong>{snapshot ? remaining : '—'}<span> / {snapshot?.waveTotal ?? '—'}</span></strong></div>
        <div className="hunt-wave-progress" role="progressbar" aria-label="Wave completion" aria-valuemin={0} aria-valuemax={100} aria-valuenow={cleared}><span style={{width:`${cleared}%`}} /></div>
      </div>
      <div className="hunt-topbar-stat hunt-opened"><small>TOTAL OPENED</small><strong>{snapshot?.openedCrates.toLocaleString('en-US') ?? '—'}</strong></div>
    </div>
  );
}
