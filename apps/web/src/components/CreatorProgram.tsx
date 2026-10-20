import { useRef, useState, type FormEvent } from "react";
import { CREATOR_PLATFORMS, CREATOR_FOLLOWERS, CREATOR_LANGUAGES, type CreatorApplicationInput } from "@herobits/shared";
import { PublicKey } from "@solana/web3.js";
import { api } from "../lib/api";
import "./creator-program.css";

export function CreatorProgram() {
  const [state, setState] = useState<"idle" | "sending" | "sent">("idle");
  const [error, setError] = useState("");
  const inFlight = useRef(false);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (inFlight.current) return;
    const form = event.currentTarget;
    const fields = new FormData(form);
    const wallet = String(fields.get("wallet") ?? "").trim();
    const walletInput = form.elements.namedItem("wallet") as HTMLInputElement;
    if (wallet) {
      try { if (new PublicKey(wallet).toBase58() !== wallet) throw new Error(); }
      catch { walletInput.setCustomValidity("Enter a valid Solana wallet address."); walletInput.reportValidity(); return; }
    }
    const body = Object.fromEntries(["name", "email", "platform", "followers", "channelUrl", "language", "about"].map(key => [key, String(fields.get(key) ?? "").trim()]));
    inFlight.current = true;
    setState("sending"); setError("");
    try {
      await api.applyCreator({ ...body, wallet, disclosure: fields.get("disclosure") === "on" } as CreatorApplicationInput);
      setState("sent");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not send your application. Please try again.");
      setState("idle");
    } finally { inFlight.current = false; }
  }
  const choices = (name: string, label: string, options: readonly string[]) => <label>{label}<select name={name} aria-label={label} required defaultValue=""><option value="" disabled>Choose…</option>{options.map(option => <option key={option}>{option}</option>)}</select></label>;
  return <section className="creator-program vault-section" id="creators" aria-labelledby="creator-heading">
    <div className="creator-intro">
      <span className="vault-eyebrow">CREATOR PROGRAM</span>
      <h2 id="creator-heading">Make content.<br/><em>Get hero boxes.</em></h2>
      <p>Do you stream, make videos or post about games? Approved creators get hero boxes to open on stream and show Bomb Miner to their audience.</p>
      <ol className="creator-steps">
        <li><span>01</span><p>Apply with the form, telling us about your channel.</p></li>
        <li><span>02</span><p>We review every application by hand.</p></li>
        <li><span>03</span><p>If approved, we contact you by email with the details and send the boxes to your wallet.</p></li>
      </ol>
      <div className="creator-safety"><span aria-hidden="true">✦</span><p>We only contact you through the email you give us. We will never ask for your seed phrase or private key.</p></div>
      <img className="creator-boxes" src="/shop/summon-cards.png" alt="" width="200" height="200" loading="lazy"/>
    </div>
    <div className="creator-form-panel">
      {state === "sent" ? <div className="creator-success" role="status"><span aria-hidden="true">✓</span><h3>Application received.</h3><p>Thanks for sharing your channel with us. Our team reviews every application by hand.</p><p>If approved, we’ll contact you at the email you provided with the next steps.</p><small>No wallet connection or signature is needed to apply.</small></div> :
      <form onSubmit={submit}>
        <div className="creator-form-heading"><span>YOUR NEXT COLLABORATION</span><h3>Tell us your story.</h3><p>All fields are required except your wallet.</p></div>
        <fieldset disabled={state === "sending"}>
          <div className="creator-fields">
            <label>Name or nickname<input name="name" autoComplete="nickname" minLength={2} maxLength={80} required/></label>
            <label>Email<input name="email" type="email" autoComplete="email" maxLength={254} required/></label>
            {choices("platform", "Main platform", CREATOR_PLATFORMS)}
            {choices("followers", "Followers", CREATOR_FOLLOWERS)}
            <label className="creator-wide">Channel link<input name="channelUrl" type="url" placeholder="https://" maxLength={500} required pattern="https?://.*"/></label>
            <div className="creator-wide">{choices("language", "Content language", CREATOR_LANGUAGES)}</div>
            <label className="creator-wide">About your channel<textarea name="about" rows={4} minLength={20} maxLength={2000} placeholder="What kind of content you make, how often you post, and how you'd show Bomb Miner." required/></label>
            <label className="creator-wide">Solana wallet (Phantom)<input name="wallet" autoComplete="off" spellCheck={false} maxLength={44} aria-describedby="creator-wallet-note" onInput={event => event.currentTarget.setCustomValidity("")}/><small id="creator-wallet-note">Used to send the boxes if you're approved. Optional for now.</small></label>
          </div>
          <label className="creator-consent"><input type="checkbox" name="disclosure" required/><span>I agree to tell my audience that I received the boxes from Bomb Miner.</span></label>
          {error && <p className="creator-error" role="alert">{error}</p>}
          <button className="vault-button vault-button-gold creator-submit" type="submit">{state === "sending" ? "SENDING APPLICATION…" : "SEND APPLICATION"}<span aria-hidden="true">→</span></button>
        </fieldset>
      </form>}
    </div>
  </section>;
}
