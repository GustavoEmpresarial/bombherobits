import { useCallback, useEffect, useState } from "react";
import { api } from "../lib/api";
import { useAuth } from "../state/AuthContext";
import type { WorldState } from "./types";

export function useWorld() {
  const { token, setUser } = useAuth();
  const [world, setWorld] = useState<WorldState | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    if (!token) return;
    const data = await api.world(token);
    setWorld(data);
    setUser(data.user);
  }, [token, setUser]);

  useEffect(() => {
    void load().catch((e) => setError(e instanceof Error ? e.message : "Failed"));
  }, [load]);

  async function run(action: () => Promise<WorldState>) {
    setBusy(true);
    setError("");
    try {
      const data = await action();
      setWorld(data);
      setUser(data.user);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed");
    } finally {
      setBusy(false);
    }
  }

  return { token, world, error, busy, setError, run, reload: load };
}
