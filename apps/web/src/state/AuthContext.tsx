import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type Dispatch,
  type ReactNode,
  type SetStateAction,
} from "react";
import type { UserDto } from "@herobits/shared";
import { api } from "../lib/api";

export const IS_DEMO = window.location.pathname === "/demo" || window.location.pathname.startsWith("/demo/");
const TOKEN_KEY = IS_DEMO ? "herobits_demo_token" : "herobits_token";
// Share the in-flight bootstrap across StrictMode effects.
let demoBootstrap: ReturnType<typeof api.demoSession> | null = null;

type AuthContextValue = {
  user: UserDto | null;
  token: string | null;
  loading: boolean;
  error: string | null;
  setUser: Dispatch<SetStateAction<UserDto | null>>;
  setSession: (token: string, user: UserDto) => void;
  logout: () => void;
  refresh: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [token, setToken] = useState<string | null>(() =>
    localStorage.getItem(TOKEN_KEY),
  );
  const [user, setUser] = useState<UserDto | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!token) {
      if (IS_DEMO) {
        setLoading(true);
        try {
          demoBootstrap ??= api.demoSession();
          const session = await demoBootstrap;
          localStorage.setItem(TOKEN_KEY, session.token);
          setToken(session.token); setUser(session.user); setError(null);
        } catch (err) { setError(err instanceof Error ? err.message : "Could not start demo"); }
        finally { demoBootstrap = null; setLoading(false); }
      } else { setUser(null); setLoading(false); }
      return;
    }
    try {
      const me = await api.me(token);
      setUser(me);
    } catch {
      localStorage.removeItem(TOKEN_KEY);
      setToken(null);
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const setSession = useCallback((nextToken: string, nextUser: UserDto) => {
    localStorage.setItem(TOKEN_KEY, nextToken);
    setToken(nextToken);
    setUser(nextUser);
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem(TOKEN_KEY);
    setToken(null);
    setUser(null);
    if (IS_DEMO) window.location.assign("/auth");
  }, []);

  const value = useMemo(
    () => ({
      user,
      token,
      loading,
      error,
      setUser,
      setSession,
      logout,
      refresh,
    }),
    [user, token, loading, error, setSession, logout, refresh],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth outside AuthProvider");
  return ctx;
}
