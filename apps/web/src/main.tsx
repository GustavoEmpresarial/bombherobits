import { inviteFromSearch } from "./lib/invites";
import { SummonProvider } from "./state/SummonContext";
import { RuntimeConfigProvider } from "./state/RuntimeConfig";
import "./polyfills";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { App } from "./App";
import { AuthProvider } from "./state/AuthContext";
import { SolanaProvider } from "./wallet/SolanaProvider";
import "./styles.css";
import "./theme.css";
import "./world.css";
import "./readability.css";
import "./polish.css";
import "./navigation.css";

// Keep shared invite links through the wallet sign-in redirect.
const invite = inviteFromSearch(window.location.search);
if (invite) {
  sessionStorage.setItem("herobits_pending_invite", invite);
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <BrowserRouter basename={window.location.pathname === "/demo" || window.location.pathname.startsWith("/demo/") ? "/demo" : undefined}>
      <SolanaProvider>
        <RuntimeConfigProvider><AuthProvider>
          <SummonProvider><App /></SummonProvider>
        </AuthProvider></RuntimeConfigProvider>
      </SolanaProvider>
    </BrowserRouter>
  </StrictMode>,
);
