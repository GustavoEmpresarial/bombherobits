import { useEffect, useState } from "react";
import type { PlayerMailDto } from "@herobits/shared";
import { PageHeading, PageState } from "../components/Page";
import { api } from "../lib/api";
import { useAuth } from "../state/AuthContext";
import "./mail.css";

export function MailPage() {
  const { token, setUser } = useAuth();
  const [messages, setMessages] = useState<PlayerMailDto[] | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState("");
  useEffect(() => {
    if (!token) return;
    let active = true;
    void api.mail(token).then(rows => { if (active) setMessages(rows); }).catch(cause => {
      if (active) setError(cause instanceof Error ? cause.message : "Could not load mail");
    });
    return () => { active = false; };
  }, [token]);

  async function claim(id: string) {
    if (!token || busy) return;
    setBusy(id); setError("");
    try {
      const result = await api.claimMail(token, id);
      setUser(result.user);
      setMessages(rows => rows?.map(mail => mail.id === id ? result.mail : mail) ?? null);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not claim mail");
    } finally { setBusy(null); }
  }

  if (!token || !messages) return <PageState error={error} retry={() => window.location.reload()} />;
  return <section className="page mail-page" aria-label="MAIL">
    <PageHeading eyebrow="THE COURIER" title="Messages from the keep." description="Boss rewards and gifts arrive here. Claim each delivery once to add it to your game balance." />
    {error && <p className="error-line" role="alert">{error}</p>}
    <div className="mail-list">
      {!messages.length && <div className="mail-empty page-panel"><span className="mail-empty-icon" aria-hidden="true">✉</span><h2>Your inbox is quiet.</h2><p>Defeat a Sentinel in the dungeon to earn a hero card.</p></div>}
      {messages.map(mail => <article className={`mail-item page-panel${mail.claimedAt ? " claimed" : ""}`} key={mail.id}>
        <span className="mail-seal" aria-hidden="true">✉</span>
        <div className="mail-copy"><small>{new Date(mail.createdAt).toLocaleDateString("en-US", { day: "numeric", month: "short", year: "numeric" })}</small><h2>{mail.title}</h2><p>{mail.body}</p>
          <div className="mail-rewards">{mail.mintCards > 0 && <span>✦ {mail.mintCards} HERO {mail.mintCards === 1 ? "CARD" : "CARDS"}</span>}{mail.gold > 0 && <span>◈ {mail.gold.toLocaleString("en-US")} GOLD</span>}{mail.scrap > 0 && <span>◆ {mail.scrap} SCRAP</span>}</div>
        </div>
        {mail.claimedAt ? <span className="mail-claimed">CLAIMED</span> : <button type="button" className="cta cta-main mail-claim" disabled={busy !== null} onClick={() => void claim(mail.id)}>{busy === mail.id ? "CLAIMING…" : "CLAIM"}</button>}
      </article>)}
    </div>
  </section>;
}
