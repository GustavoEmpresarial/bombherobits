import { useEffect, useRef, useState, type FormEvent } from "react";
import type { MarketingConfig, WhitelistApplicationInput } from "@herobits/shared";
import { api } from "../lib/api";
import "./marketing-gateway.css";

export const EMPTY_MARKETING: MarketingConfig = { xUrl: null, discordUrl: null, contract: null, buyUrl: null, whitelistOpen: false };
export function useMarketing() {
  const [config, setConfig] = useState(EMPTY_MARKETING);
  useEffect(() => { let active = true; api.marketing().then(value => { if (active) setConfig(value); }).catch(() => {}); return () => { active = false; }; }, []);
  return config;
}
export function CommunityButton({ url, kind, compact = false }: { url: string | null; kind: "X" | "Discord"; compact?: boolean }) {
  const content = <><span aria-hidden="true" className="social-symbol">{kind === "X" ? "𝕏" : <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor"><path d="M19.7 5.5a18 18 0 0 0-4.4-1.4l-.5 1a16.5 16.5 0 0 0-5.6 0l-.5-1a18 18 0 0 0-4.4 1.4C1.5 9.7.7 13.8 1.1 17.8a18 18 0 0 0 5.4 2.7l1.1-1.8-1.7-.8.4-.3c3.7 1.7 7.7 1.7 11.4 0l.4.3-1.7.8 1.1 1.8a18 18 0 0 0 5.4-2.7c.5-4.6-.8-8.7-3.2-12.3ZM8.5 14.8c-1 0-1.8-.9-1.8-2s.8-2 1.8-2 1.8.9 1.8 2-.8 2-1.8 2Zm7 0c-1 0-1.8-.9-1.8-2s.8-2 1.8-2 1.8.9 1.8 2-.8 2-1.8 2Z"/></svg>}</span>{!compact && kind}{!url && <small>Coming soon</small>}</>;
  return url ? <a className="miner-social" href={url} target="_blank" rel="noreferrer" aria-label={"Join us on " + kind}>{content}</a> : <button className="miner-social" type="button" disabled aria-label={kind + " coming soon"}>{content}</button>;
}
export function MarketingSections({ config }: { config: MarketingConfig }) {
  const [copied, setCopied] = useState(false);
  const [copyError, setCopyError] = useState("");
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const locked = useRef(false);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (locked.current || !config.whitelistOpen) return;
    const data = new FormData(event.currentTarget);
    const body = Object.fromEntries(["email", "xHandle", "discordUsername", "wallet"].map(key => [key, String(data.get(key) ?? "").trim()]));
    locked.current = true; setBusy(true); setError("");
    try {
      await api.applyWhitelist({ ...body, followedX: data.get("followedX") === "on", joinedDiscord: data.get("joinedDiscord") === "on" } as WhitelistApplicationInput);
      setSent(true);
    } catch (err) { setError(err instanceof Error ? err.message : "Could not send application."); }
    finally { locked.current = false; setBusy(false); }
  }
  return <>
    <section className="miner-token vault-section" id="token" aria-labelledby="token-heading">
      <div><span className="miner-kicker">THE TOKEN</span><h2 id="token-heading">Small bombs.<br/><em>Big energy.</em></h2><p>$BMINER is the planned token for the Bomb Miner ecosystem. Contract and launch details will appear here once confirmed.</p><span className="miner-network"><i/> SOLANA · PUMP.FUN <small>PLANNED</small></span></div>
      <div className="miner-contract"><div className="miner-contract-top"><span>$BMINER</span><small>{config.contract ? "CONTRACT AVAILABLE" : "PRE-LAUNCH"}</small></div><label htmlFor="miner-contract-address">Contract address</label><div className="miner-contract-value"><input id="miner-contract-address" readOnly value={config.contract ?? "Not announced yet"} aria-label="Token contract address"/><button type="button" disabled={!config.contract} onClick={async () => { try { await navigator.clipboard.writeText(config.contract!); setCopied(true); setCopyError(""); } catch { setCopyError("Copy unavailable. Select the address above to copy it."); } }}>{copied ? "COPIED ✓" : "COPY"}</button></div><p role="status">{copyError || (config.contract ? "Check the full address before using it." : "No token is live yet. Wait for the official contract here.")}</p>{config.buyUrl ? <a className="vault-button vault-button-gold" href={config.buyUrl} target="_blank" rel="noreferrer">VIEW ON PUMP.FUN ↗</a> : <button type="button" className="miner-buy-soon" disabled>BUY $BMINER <span>COMING SOON</span></button>}</div>
    </section>
    <section className="miner-community vault-section" id="community" aria-labelledby="community-heading">
      <div className="vault-section-heading"><span className="miner-kicker">THE FIRST WAVE</span><h2 id="community-heading">Find your people.<br/><em>Build the first squad.</em></h2><p>Development updates on X. The community on Discord.<br/>Follow both to apply for early access.</p></div>
      <div className="miner-community-grid"><article><span className="miner-community-number">01 / FOLLOW</span><h3>Catch the signal.</h3><p>Gameplay clips, development notes and every official launch update.</p><CommunityButton kind="X" url={config.xUrl}/></article><article><span className="miner-community-number">02 / JOIN</span><h3>Enter the squad.</h3><p>Meet players, share feedback and find the official whitelist announcements.</p><CommunityButton kind="Discord" url={config.discordUrl}/></article><article><span className="miner-community-number">03 / APPLY</span><h3>Get early access.</h3><p>Follow X, join Discord and apply for early access to the game. Every application is reviewed manually.</p><a className="miner-whitelist-link" href="#whitelist">WHITELIST <span>↓</span></a></article></div>
    </section>
    <section className="miner-whitelist vault-section" id="whitelist" aria-labelledby="whitelist-heading">
      <div><span className="miner-kicker">EARLY ACCESS</span><h2 id="whitelist-heading">Be here<br/><em>from the first blast.</em></h2><p>The game is not open to the public. The whitelist is your application for early access. Follow our official X account and join our Discord; the team checks both before approval.</p><ul><li>One application per person.</li><li>No payment or wallet signature to apply.</li><li>Approval is required to play when early access opens.</li></ul></div>
      <div className="miner-whitelist-panel">{!config.whitelistOpen ? <><span className="miner-status">APPLICATIONS NOT OPEN</span><h3>The squad is forming.</h3><p>The game is coming soon. Early-access whitelist applications open here after our official X and Discord launch.</p><div className="miner-community-actions"><CommunityButton kind="X" url={config.xUrl}/><CommunityButton kind="Discord" url={config.discordUrl}/></div><button className="vault-button vault-button-gold" type="button" disabled>WHITELIST · COMING SOON</button></> : sent ? <div role="status"><span className="miner-status">APPLICATION RECEIVED</span><h3>You’re in the review queue.</h3><p>Our team will manually check your X and Discord participation. This is an early-access application, not permission to play yet.</p></div> : <form onSubmit={submit}><h3>Apply for early access.</h3><fieldset disabled={busy}><label>Email<input type="email" name="email" maxLength={254} required/></label><label>X handle<input name="xHandle" placeholder="@yourhandle" maxLength={16} pattern="@?[A-Za-z0-9_]{1,15}" required/></label><label>Discord username<input name="discordUsername" placeholder="your.username" minLength={2} maxLength={32} pattern="[a-z0-9_.]+" required/></label><label>Solana wallet <small>Optional</small><input name="wallet" maxLength={44} autoComplete="off"/></label><label className="miner-check"><input type="checkbox" name="followedX" required/>I follow the official X account.</label><label className="miner-check"><input type="checkbox" name="joinedDiscord" required/>I joined the official Discord server.</label>{error && <p role="alert" className="creator-error">{error}</p>}<button type="submit" className="vault-button vault-button-gold">{busy ? "SENDING…" : "APPLY FOR WHITELIST"}</button><p className="miner-form-note">Participation is self-reported here and checked manually by our team.</p></fieldset></form>}</div>
    </section>
    <section className="miner-paper vault-section" id="whitepaper"><span className="miner-kicker">KNOW THE PROJECT</span><h2>Read before<br/><em>the first blast.</em></h2><p>The game, the community, the launch plan. Our draft whitepaper separates what exists today from what’s planned next.</p><a className="vault-button vault-button-outline" href="/whitepaper">READ WHITEPAPER <span>↗</span></a><small>WORKING DRAFT · V0.1 · OCTOBER 2026</small></section>
  </>;
}
