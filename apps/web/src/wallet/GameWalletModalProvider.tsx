import { useEffect, useRef, useState, type ReactNode } from "react";
import { WalletReadyState } from "@solana/wallet-adapter-base";
import { useWallet } from "@solana/wallet-adapter-react";
import { WalletModalContext } from "@solana/wallet-adapter-react-ui";
import { BrandWordmark } from "../components/BrandWordmark";

const SUPPORTED_WALLETS = [
  { name: "Backpack", url: "https://backpack.app/download" },
  { name: "Phantom", url: "https://phantom.app/" },
  { name: "Solflare", url: "https://solflare.com/" },
];

/** Keep supported wallets visible even before their extensions register. */
export function GameWalletModalProvider({ children }: { children: ReactNode }) {
  const [visible, setVisible] = useState(false);
  return (
    <WalletModalContext.Provider value={{ visible, setVisible }}>
      {children}
      {visible && <GameWalletModal close={() => setVisible(false)} />}
    </WalletModalContext.Provider>
  );
}

function GameWalletModal({ close }: { close: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const { wallets, wallet: selected, select, connect } = useWallet();
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const hasInstalledWallet = wallets.some(({ readyState }) => readyState === WalletReadyState.Installed);

  useEffect(() => {
    const element = dialog.current;
    const previousFocus = document.activeElement;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    element?.showModal();
    return () => {
      element?.close();
      document.body.style.overflow = overflow;
      if (previousFocus instanceof HTMLElement) previousFocus.focus();
    };
  }, []);

  const options = [
    ...SUPPORTED_WALLETS,
    ...wallets.filter(({ adapter, readyState }) =>
      readyState === WalletReadyState.Installed &&
      !SUPPORTED_WALLETS.some(({ name }) => name === adapter.name),
    ).map(({ adapter }) => ({ name: adapter.name, url: adapter.url })),
  ];

  async function choose(name: string) {
    const available = wallets.find(({ adapter }) => adapter.name === name);
    if (!available) return;
    setError("");
    if (selected?.adapter.name === name) {
      setBusy(true);
      try {
        await connect();
        close();
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : "Connection cancelled. Try again.");
      } finally {
        setBusy(false);
      }
    } else {
      // WalletProvider autoConnect handles the newly selected adapter, including
      // Backpack's dynamically registered Solana Wallet Standard adapter.
      select(available.adapter.name);
      close();
    }
  }

  return (
    <dialog ref={dialog} className="game-wallet-modal" aria-labelledby="game-wallet-title"
      onCancel={close} onClick={(event) => { if (event.target === event.currentTarget) close(); }}>
      <div className="game-wallet-panel">
        <button type="button" className="game-wallet-close" onClick={close} aria-label="Close wallet selector">×</button>
        <BrandWordmark />
        <p className="game-wallet-eyebrow">YOUR ADVENTURE STARTS HERE</p>
        <h2 id="game-wallet-title">Connect your wallet</h2>
        <p className="game-wallet-description">{hasInstalledWallet
          ? "Choose a Solana wallet to enter the vault."
          : "No wallet extension was detected in this browser. Open this game in the browser where your Solana wallet is installed, then connect there."}</p>
        <ul className="game-wallet-list">
          {options.map(({ name, url }) => {
            const wallet = wallets.find(({ adapter }) => adapter.name === name);
            const installed = wallet?.readyState === WalletReadyState.Installed;
            const content = <>
              {wallet?.adapter.icon ? <img src={wallet.adapter.icon} alt="" width="40" height="40" /> :
                <span className="backpack-wallet-icon" aria-hidden="true"><svg viewBox="0 0 32 32" fill="none"><path d="M11 10V8a5 5 0 0 1 10 0v2M9 10h14a3 3 0 0 1 3 3v13H6V13a3 3 0 0 1 3-3Z" stroke="currentColor" strokeWidth="2.5" strokeLinejoin="round"/><path d="M10 19h12v7H10zM11 14h10" stroke="currentColor" strokeWidth="2" strokeLinejoin="round"/></svg></span>}
              <span className="game-wallet-name">{name}<small>{installed ? "Detected · Ready to connect" : "Browser extension or mobile app"}</small></span>
              <span className="game-wallet-action">{installed ? "Connect →" : "Install ↗"}</span>
            </>;
            return <li key={name}>{installed ?
              <button type="button" disabled={busy} onClick={() => void choose(name)} aria-label={`Connect ${name}`}>{content}</button> :
              <a href={url} target="_blank" rel="noopener noreferrer" aria-label={`Install ${name}`}>{content}</a>}
            </li>;
          })}
        </ul>
        {error && <p className="game-wallet-error" role="alert">{error}</p>}
        <p className="game-wallet-note">{hasInstalledWallet
          ? "Open and unlock your wallet extension before connecting."
          : "An in-app browser does not share wallet extensions with Chrome, Brave or Firefox. If your wallet is already installed there, you do not need to install it again."}</p>
      </div>
    </dialog>
  );
}
