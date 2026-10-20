const validInvite = (value: string | null): value is string => Boolean(value && /^[a-zA-Z0-9]{4,64}$/.test(value));

export function inviteFromSearch(search: string): string | null {
 const params = new URLSearchParams(search);
 const invite = params.get("invite");
 return params.getAll("invite").length === 1 && validInvite(invite) ? invite : null;
}

export function createInviteLink(origin: string, invite: string, path = "/auth"): string {
 const link = new URL(path, origin);
 link.searchParams.set("invite", invite);
 return link.toString();
}

export function inviteFromLink(value: string): string | null {
 try {
  const link = new URL(value.trim());
  if (!['http:', 'https:'].includes(link.protocol) || link.username || link.password || !['/auth', '/invites', '/demo', '/demo/invites'].includes(link.pathname.replace(/\/$/, ''))) return null;
  return inviteFromSearch(link.search);
 } catch { return null; }
}
