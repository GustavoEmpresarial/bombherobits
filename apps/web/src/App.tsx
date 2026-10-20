import { BrandWordmark } from "./components/BrandWordmark";
import { lazy, Suspense, useEffect, useState } from "react";
import { api } from "./lib/api";
import { PageState } from "./components/Page";
import { Navigate, Route, Routes } from "react-router-dom";
import { IS_DEMO, useAuth } from "./state/AuthContext";
import { Layout } from "./components/Layout";
import { AuthPage } from "./pages/AuthPage";
import { WhitepaperPage } from "./pages/WhitepaperPage";
import { HomePage } from "./pages/HomePage";
const DungeonPage = lazy(() => import("./pages/DungeonPage").then((module) => ({ default: module.DungeonPage })));
import { ShopPage } from "./pages/ShopPage";
import { SummonPage } from "./pages/SummonPage";
import { BlacksmithPage } from "./pages/BlacksmithPage";
import { PorterPage } from "./pages/PorterPage";
import { MarketPage } from "./pages/MarketPage";
import { InvitesPage } from "./pages/InvitesPage";
import { ChestPage } from "./pages/ChestPage";
import { WithdrawPage } from "./pages/WithdrawPage";
import { SettingsPage } from "./pages/SettingsPage";

function Private({ children }: { children: React.ReactNode }) {
  const { token, loading, error, logout } = useAuth();
  const [verifiedToken, setVerifiedToken] = useState<string | null>(null);
  useEffect(() => {
    let active = true;
    if (token) api.me(token).then(() => {
      if (active) setVerifiedToken(token);
    }).catch(() => { if (active) logout(); });
    return () => { active = false; };
  }, [token, logout]);
  if (loading || (token && verifiedToken !== token))
    return (
      <div className="auth-page">
        <p className="loading-logo">
          <BrandWordmark />
        </p>
      </div>
    );
  if (error) return <PageState error={error} retry={() => window.location.reload()} />;
  if (!token) return <Navigate to="/auth" replace />;
  return children;
}

export function App() {
  return (
    <Routes>
      <Route path="/auth" element={IS_DEMO ? <Navigate to="/" replace /> : <AuthPage />} />
      <Route path="/whitepaper" element={<WhitepaperPage />} />
      <Route
        path="/"
        element={
          <Private>
            <Layout />
          </Private>
        }
      >
        <Route index element={<HomePage />} />
        <Route path="heroes" element={<Navigate to="/dungeon" replace />} />
        <Route path="dungeon" element={<Suspense fallback={<PageState />}><DungeonPage /></Suspense>} />
        <Route path="shop" element={<ShopPage />} />
        <Route path="shop/summon" element={<SummonPage />} />
        <Route path="shop/blacksmiths" element={<BlacksmithPage />} />
        <Route path="shop/porter" element={<PorterPage />} />
        <Route path="market" element={<MarketPage />} />
        <Route path="invites" element={<InvitesPage />} />
        <Route path="chest" element={<ChestPage />} />
        <Route path="withdraw" element={<WithdrawPage />} />
        <Route path="settings" element={<SettingsPage />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
