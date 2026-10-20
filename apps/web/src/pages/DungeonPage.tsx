import { useCallback, useEffect, useRef, useState } from "react";
import type Phaser from "phaser";
import { arenaTheme, type DungeonSnapshot } from "@herobits/shared";
import { useRuntimeConfig } from "../state/RuntimeConfig";
import { useOutletContext } from "react-router-dom";
import type { DungeonLayoutContext } from "../components/Layout";
import { api } from "../lib/api";
import { HeroSidebar } from "../components/HeroSidebar";
import { useAuth } from "../state/AuthContext";
import { selectDungeonSnapshot } from "../game/snapshot-order";
import { createDungeonGame, DungeonScene } from "../game/DungeonScene";

export function DungeonPage() {
  const {GAME}=useRuntimeConfig();
  const {setHuntSnapshot} = useOutletContext<DungeonLayoutContext>();
  const { token, setUser } = useAuth();
  const hostRef = useRef<HTMLDivElement>(null);
  const gameRef = useRef<Phaser.Game | null>(null);
  const [snapshot, setSnapshot] = useState<DungeonSnapshot | null>(null);
  useEffect(() => {
    setHuntSnapshot(snapshot);
    if (snapshot) setUser((prev) => prev ? { ...prev, gold: snapshot.gold, chest: snapshot.chest } : prev);
  }, [snapshot, setHuntSnapshot, setUser]);
  useEffect(() => () => setHuntSnapshot(null), [setHuntSnapshot]);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [heroesOpen, setHeroesOpen] = useState(true);
  const closeHeroes = useCallback(() => setHeroesOpen(false), []);

  useEffect(() => {
    if (!hostRef.current || gameRef.current) return;
    gameRef.current = createDungeonGame(hostRef.current);
    return () => {
      gameRef.current?.destroy(true);
      gameRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (!snapshot || !gameRef.current) return;
    const apply = () => {
      const scene = gameRef.current?.scene.getScene("DungeonScene") as DungeonScene | undefined;
      scene?.applySnapshot(snapshot);
    };
    apply();
    const t = window.setTimeout(apply, 80);
    return () => window.clearTimeout(t);
  }, [snapshot]);

  useEffect(() => {
    if (!token) return;
    let ws: WebSocket | null = null;
    let closed = false;
    let reconnect: number | undefined;

    function connect() {
      if (closed) return;
      ws = new WebSocket(api.wsUrl(token!));
      ws.onopen = () => { if (!closed) setError(""); };
      ws.onmessage = (ev) => {
        if (closed) return;
        try {
          const msg = JSON.parse(String(ev.data)) as { type: string; data?: DungeonSnapshot };
          if (msg.type === "snapshot" && msg.data) {
            applyPartyState(msg.data);
          }
        } catch { /* Ignore malformed messages. */ }
      };
      ws.onclose = () => {
        if (closed) return;
        setError("Connection interrupted. Reconnecting…");
        reconnect = window.setTimeout(connect, 2000);
      };
      ws.onerror = () => ws?.close();
    }

    async function boot() {
      try {
        const state = await api.startDungeon(token!);
        if (closed) return;
        setSnapshot((previous) => selectDungeonSnapshot(previous, state));

        connect();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to enter dungeon");
      }
    }

    void boot();

    return () => {
      closed = true;
      window.clearTimeout(reconnect);
      ws?.close();
    };
  }, [token, setUser]);

  function applyPartyState(state: DungeonSnapshot) {
    setSnapshot((previous) => selectDungeonSnapshot(previous, state));
  }

  async function updateParty(action: () => Promise<DungeonSnapshot>) {
    if (!token || busy) return;
    setBusy(true);
    setError("");
    try {
      applyPartyState(await action());
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not update your party");
      // A bulk action may have partially succeeded; show the server's latest state.
      try { applyPartyState(await api.dungeonState(token)); } catch { /* Keep the action error. */ }
    } finally {
      setBusy(false);
    }
  }

  function workHeroes(heroId?: string) {
    if (!token) return;
    void updateParty(() => api.deploy(token, heroId ? { heroId } : { all: true }));
  }

  function restHeroes(ids: string[]) {
    if (!token || !snapshot) return;
    const targets = snapshot.heroes.filter((hero) => ids.includes(hero.id) && hero.status !== "LISTED");
    void updateParty(async () => {
      for (const hero of targets) {
        await api.restHero(token, hero.id);
      }
      return api.dungeonState(token);
    });
  }

  const working = snapshot?.working ?? 0;
  const theme = arenaTheme(snapshot?.wave ?? 1);

  return (
    <div className="screen screen-hunt" data-heroes-open={heroesOpen} data-arena-theme={theme.id} style={{ backgroundColor: theme.background }}>
      <div className="map-frame" style={{ backgroundColor: theme.background }}>
        <div className="dungeon-host" ref={hostRef} />
      </div>

      <div className="hunt-overlay">
        {error && !heroesOpen && (
          <p className="error-line hunt-heroes-error" role="alert">
            {error}
          </p>
        )}


        {!heroesOpen && snapshot?.heroes.some((hero) => hero.status === "IDLE" && hero.stamina > 0) && working < GAME.MAX_WORKING_HEROES && (
          <div className="hunt-corner"><button className="cta cta-main hunt-deploy" disabled={busy} onClick={() => workHeroes()}>{busy ? "DEPLOYING…" : "DEPLOY ALL"}</button></div>
        )}
      </div>
      <HeroSidebar open={heroesOpen} snapshot={snapshot} busy={busy} error={error} onToggle={() => setHeroesOpen((open) => !open)} onClose={closeHeroes} onWork={workHeroes} onRest={restHeroes} />
    </div>
  );
}
