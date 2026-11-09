import { BrandWordmark } from "./components/BrandWordmark";
import { lazy, Suspense } from "react";
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
import { FusionPage } from "./pages/FusionPage";
import { RankingPage } from "./pages/RankingPage";
import { ArmoryPage } from "./pages/ArmoryPage";
import { ScrapShopPage } from "./pages/ScrapShopPage";
import { GearShopPage } from "./pages/GearShopPage";
import { TeamPage } from "./pages/TeamPage";
import { HallPage } from "./pages/HallPage";
import { MailPage } from "./pages/MailPage";
import { StakePage } from "./pages/StakePage";
import { InvitesPage } from "./pages/InvitesPage";
import { ChestPage } from "./pages/ChestPage";
import { WithdrawPage } from "./pages/WithdrawPage";
import { SettingsPage } from "./pages/SettingsPage";

function Private({ children }: { children: React.ReactNode }) {
  const { token, user, loading, error } = useAuth();
  if (loading)
    return (
      <div className="auth-page">
        <p className="loading-logo">
          <BrandWordmark />
        </p>
      </div>
    );
  if (error) return <PageState error={error} retry={() => window.location.reload()} />;
  if (!token || !user) return <Navigate to="/auth" replace />;
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
        <Route path="heroes" element={<TeamPage />} />
        <Route path="hall" element={<HallPage />} />
        <Route path="dungeon" element={<Suspense fallback={<PageState />}><DungeonPage /></Suspense>} />
        <Route path="shop" element={<ShopPage />} />
        <Route path="shop/summon" element={<SummonPage />} />
        <Route path="shop/blacksmiths" element={<BlacksmithPage />} />
        <Route path="shop/porter" element={<PorterPage />} />
        <Route path="shop/scrap" element={<ScrapShopPage />} />
        <Route path="shop/gear" element={<GearShopPage />} />
        <Route path="market" element={<MarketPage />} />
        <Route path="fusion" element={<FusionPage />} />
        <Route path="ranking" element={<RankingPage />} />
        <Route path="stake" element={<StakePage />} />
        <Route path="armory" element={<ArmoryPage />} />
        <Route path="mail" element={<MailPage />} />
        <Route path="invites" element={<InvitesPage />} />
        <Route path="chest" element={<ChestPage />} />
        <Route path="withdraw" element={<WithdrawPage />} />
        <Route path="settings" element={<SettingsPage />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
