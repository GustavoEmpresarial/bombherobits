import { useMemo, type ReactNode } from "react";
import {
  ConnectionProvider,
  WalletProvider,
} from "@solana/wallet-adapter-react";
import { GameWalletModalProvider } from "./GameWalletModalProvider";
import { PhantomWalletAdapter } from "@solana/wallet-adapter-phantom";
import { SolflareWalletAdapter } from "@solana/wallet-adapter-solflare";
import { WalletAdapterNetwork } from "@solana/wallet-adapter-base";
import { clusterApiUrl } from "@solana/web3.js";
import "@solana/wallet-adapter-react-ui/styles.css";

const network = WalletAdapterNetwork.Mainnet;

export function SolanaProvider({ children }: { children: ReactNode }) {
  const endpoint =
    import.meta.env.VITE_SOLANA_RPC?.trim() || clusterApiUrl(network);

  // WalletProvider also discovers Wallet Standard registrations (including Backpack)
  // and adapts their message signing without a separate legacy wallet adapter.
  const wallets = useMemo(
    () => [new PhantomWalletAdapter(), new SolflareWalletAdapter({ network })],
    [],
  );

  return (
    <ConnectionProvider endpoint={endpoint}>
      <WalletProvider wallets={wallets} autoConnect>
        <GameWalletModalProvider>{children}</GameWalletModalProvider>
      </WalletProvider>
    </ConnectionProvider>
  );
}
