import type {
  AuthNonceResponse,
  AuthResponse,
  DungeonSnapshot,
  HeroDto,
  UserDto,
  SummonBatchDto, SummonPurchaseDto, SummonClaimDto,
} from "@herobits/shared";

const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:3001";

function authHeaders(token?: string | null): HeadersInit {
  const headers: HeadersInit = { "Content-Type": "application/json" };
  if (token) headers.Authorization = `Bearer ${token}`;
  return headers;
}

async function request<T>(
  path: string,
  options: RequestInit & { token?: string | null } = {},
): Promise<T> {
  const { token, ...init } = options;
  const res = await fetch(`${API_URL}${path}`, {
    ...init,
    headers: {
      ...authHeaders(token),
      ...(init.headers ?? {}),
    },
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw Object.assign(new Error(typeof data.error === "string" ? data.error : "Request failed"),{statusCode:res.status});
  }
  return data as T;
}

export const api = {
  demoSession: () => request<AuthResponse>("/demo/session", { method: "POST", body: "{}" }),
  marketing: () => request<import("@herobits/shared").MarketingConfig>("/marketing", { cache: "no-store" }),
  applyWhitelist: (body: import("@herobits/shared").WhitelistApplicationInput) =>
    request<{ accepted: true }>("/whitelist/applications", { method: "POST", body: JSON.stringify(body), signal: AbortSignal.timeout(30000) }),
  applyCreator: (body: import("@herobits/shared").CreatorApplicationInput) =>
    request<{ accepted: true }>("/creators/applications", { method: "POST", body: JSON.stringify(body), signal: AbortSignal.timeout(30000) }),
  authNonce: (wallet: string) =>
    request<AuthNonceResponse>("/auth/nonce", {
      method: "POST",
      body: JSON.stringify({ wallet }),
    }),

  authWallet: (body: { wallet: string; signature: string; nonce: string }) =>
    request<AuthResponse & { isNew?: boolean }>("/auth/wallet", {
      method: "POST",
      body: JSON.stringify(body),
    }),

  me: (token: string) => request<UserDto>("/me", { token }),

  heroes: (token: string) => request<HeroDto[]>("/heroes", { token }),

  summon: (token: string, count: number, requestId: string) => request<SummonPurchaseDto>("/heroes/summon", {method:"POST",token,signal:AbortSignal.timeout(30000),body:JSON.stringify({count,requestId})}),
  pendingSummons: (token: string) => request<SummonBatchDto[]>("/heroes/summons/pending", {token,cache:"no-store",signal:AbortSignal.timeout(30000)}),
  revealSummon: (token: string, id: string) => request<SummonBatchDto>("/heroes/summons/"+id+"/reveal", {method:"POST",token,signal:AbortSignal.timeout(30000),body:"{}"}),
  claimSummon: (token: string, id: string) => request<SummonClaimDto>("/heroes/summons/"+id+"/claim", {method:"POST",token,signal:AbortSignal.timeout(30000),body:"{}"}),

  restHero: (token: string, id: string) =>
    request<HeroDto>(`/heroes/${id}/rest`, {
      method: "POST",
      token,
      body: "{}",
    }),

  deactivateHero: (token: string, id: string) =>
    request<HeroDto>(`/heroes/${id}/deactivate`, {
      method: "POST",
      token,
      body: "{}",
    }),

  startDungeon: (token: string) =>
    request<DungeonSnapshot>("/dungeon/start", {
      method: "POST",
      token,
      body: "{}",
    }),

  dungeonState: (token: string) =>
    request<DungeonSnapshot>("/dungeon/state", { token }),

  deploy: (token: string, body: { heroId?: string; all?: boolean }) =>
    request<DungeonSnapshot>("/dungeon/deploy", {
      method: "POST",
      token,
      body: JSON.stringify(body),
    }),

  wsUrl: (token: string) =>
    `${API_URL.replace(/^http/, "ws")}/dungeon/ws?token=${encodeURIComponent(token)}`,

  world: (token: string) => request<import("../pages/types").WorldState>("/world", { token }),

  buyBlacksmith: (token: string, tier: number) =>
    request<import("../pages/types").WorldState>("/blacksmiths/buy", {
      method: "POST",
      token,
      body: JSON.stringify({ tier }),
    }),

  setBlacksmith: (token: string, id: string) =>
    request<import("../pages/types").WorldState>("/blacksmiths/service", {
      method: "POST",
      token,
      body: JSON.stringify({ id }),
    }),

  buyPorter: (token: string) =>
    request<import("../pages/types").WorldState>("/porters/buy", {
      method: "POST",
      token,
      body: "{}",
    }),

  togglePorter: (token: string) =>
    request<import("../pages/types").WorldState>("/porters/toggle", {
      method: "POST",
      token,
      body: "{}",
    }),

  marketList: (token: string, body: { kind: string; refId: string; price: number }) =>
    request<import("../pages/types").WorldState>("/market/list", {
      method: "POST",
      token,
      body: JSON.stringify(body),
    }),

  marketBuy: (token: string, id: string) =>
    request<import("../pages/types").WorldState>("/market/buy", {
      method: "POST",
      token,
      body: JSON.stringify({ id }),
    }),

  openChest: (token: string, count: number, requestId: string) => request<SummonPurchaseDto>("/chest/open", {method:"POST",token,signal:AbortSignal.timeout(30000),body:JSON.stringify({count,requestId})}),

  withdraw: (token: string) =>
    request<{ user: UserDto; fee: number; net: number }>("/chest/withdraw", {
      method: "POST",
      token,
      body: "{}",
    }),

  redeemInvite: (token: string, code: string) =>
    request<import("../pages/types").WorldState>("/invites/redeem", {
      method: "POST",
      token,
      body: JSON.stringify({ code }),
    }),
};
