import {useRuntimeConfig} from "../state/RuntimeConfig";
import { PageHeading, PageState } from "../components/Page";
import { useEffect, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { api } from "../lib/api";
import { createInviteLink, inviteFromLink, inviteFromSearch } from "../lib/invites";
import { IS_DEMO, useAuth } from "../state/AuthContext";
import { useWorld } from "./useWorld";

export function InvitesPage() {
  const {config}=useRuntimeConfig();
  const { token } = useAuth();
  const {search}=useLocation();
  const navigate=useNavigate();
  const { world, error, busy, run, setError } = useWorld();
  const [friendLink,setFriendLink]=useState(()=>{
    const pending=inviteFromSearch(search)??sessionStorage.getItem("herobits_pending_invite");
    return pending?createInviteLink(window.location.origin,pending,IS_DEMO ? "/demo/invites" : "/auth"):"";
  });
  const [copied,setCopied]=useState(false),[joined,setJoined]=useState(false);
  const submitting=useRef(false);
  useEffect(()=>{
    const incoming=inviteFromSearch(search);
    if(incoming){sessionStorage.setItem("herobits_pending_invite",incoming);setFriendLink(createInviteLink(window.location.origin,incoming,IS_DEMO ? "/demo/invites" : "/auth"));setJoined(false);}
  },[search]);
  useEffect(()=>{if(!copied)return;const timer=window.setTimeout(()=>setCopied(false),2500);return()=>window.clearTimeout(timer);},[copied]);
  if (!world) return <PageState error={error} retry={() => window.location.reload()} />;
  const link=createInviteLink(window.location.origin,world.user.inviteCode,IS_DEMO ? "/demo/invites" : "/auth");
  const friendInvite=inviteFromLink(friendLink);

  return (
    <section className="page invites-page" aria-label="INVITES">
      <PageHeading eyebrow="ADVENTURES ARE BETTER TOGETHER" title="Bring a friend to the dungeon." description="Share your invite link and grow your little corner of the Bomb Hero Bits world." />
      <section className="page-panel summon-buy">
        <h2 className="page-panel-title">Invite your friends</h2>
        <p className="page-panel-text">Share your personal link. Your friend can connect their wallet and accept your invitation.</p>
        <label className="invite-link-label" htmlFor="personal-invite-link">YOUR INVITE LINK</label>
        <div className="invite-link-box">
          <input id="personal-invite-link" className="sell-input" value={link} readOnly onFocus={event=>event.currentTarget.select()} />
          <button type="button" className="cta-alt" onClick={async()=>{
            setError("");
            try{await navigator.clipboard.writeText(link);setCopied(true);}
            catch{setError("Could not copy automatically. Select your invite link and copy it manually.");}
          }}>{copied?"COPIED ✓":"COPY LINK"}</button>
        </div>
        <span className="invite-copy-status" role="status">{copied?"Invite link copied. Ready to share!":"Send this link to a friend to invite them."}</span>
        <div className="invite-rules">
          <p>You receive {config.referrals.hostCards} mint {config.referrals.hostCards===1?"card":"cards"} and your friend receives {config.referrals.guestCards} when they accept your invitation.</p>
          <p>Cards wait in the chest. Open them to rescue a hero.</p>
        </div>
        <label className="invite-link-label" htmlFor="friend-invite-link">RECEIVED AN INVITATION?</label>
        <form className="invite-join-row invite-link-join" onSubmit={event=>{
          event.preventDefault();
          if(!token||!friendInvite||submitting.current)return;
          submitting.current=true;
          void run(async()=>{
            const result=await api.redeemInvite(token,friendInvite);
            sessionStorage.removeItem("herobits_pending_invite");
            setJoined(true);setFriendLink("");navigate("/invites",{replace:true});
            return result;
          }).finally(()=>{submitting.current=false;});
        }}>
          <input id="friend-invite-link" className="sell-input" type="url" value={friendLink} aria-label="Friend invite link" placeholder={`${window.location.origin}/auth?invite=…`} autoComplete="off" spellCheck={false} onChange={event=>{setFriendLink(event.target.value);setJoined(false);setError("");}} />
          <button className="cta cta-main" type="submit" disabled={busy||!friendInvite}>{busy?"JOINING…":"ACCEPT INVITE"}</button>
        </form>
        {friendLink&&!friendInvite&&<p className="page-note">Paste the complete invite link shared by your friend.</p>}
        {joined&&<p className="invite-success" role="status">Invitation accepted! Your mint cards are waiting in the chest.</p>}
        {error&&<p className="error-line" role="alert">{error}</p>}
        <p className="page-note">Mint cards in chest: {world.user.mintCards}</p>
      </section>
    </section>
  );
}
