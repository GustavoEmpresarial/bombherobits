import type {
  AuthNonceResponse,
  AuthResponse,
  DungeonSnapshot,
  HeroDto,
  UserDto,
  SummonBatchDto, SummonPurchaseDto, SummonClaimDto,
  FusionResultDto,
  PlayerMailDto,
  GearPieceDto,
  GearRarity,
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
  equipment: (token: string) => request<GearPieceDto[]>("/equipment", { token, cache: "no-store" }),
  buyEquipment: (token: string, rarity: GearRarity, requestKey: string) => request<{ piece: GearPieceDto | null; user: UserDto; repeated: boolean }>("/equipment/boxes", { method: "POST", token, body: JSON.stringify({ rarity, requestKey }) }),
  equipEquipment: (token: string, id: string, heroId: string) => request<GearPieceDto>(`/equipment/${id}/equip`, { method: "POST", token, body: JSON.stringify({ heroId }) }),
  removeEquipment: (token: string, id: string) => request<GearPieceDto>(`/equipment/${id}/remove`, { method: "POST", token, body: "{}" }),
  repairEquipment: (token: string, id: string) => request<{ piece: GearPieceDto; user: UserDto; cost: number }>(`/equipment/${id}/repair`, { method: "POST", token, body: "{}" }),
  salvageEquipment: (token: string, pieceIds: string[]) => request<{ gained: number; user: UserDto }>("/equipment/salvage", { method: "POST", token, body: JSON.stringify({ pieceIds }) }),
  fuseEquipment: (token: string, pieceIds: string[]) => request<{ piece: GearPieceDto; user: UserDto; cost: number }>("/equipment/fusion", { method: "POST", token, body: JSON.stringify({ pieceIds }) }),
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
  scrapHero: (token: string, id: string) => request<{ scrapReceived: number; user: UserDto }>(`/heroes/${id}/scrap`, { method: "POST", token, body: "{}" }),
  buyScrap: (token: string, amount: number, source: "gold" | "chest" = "gold") => request<{ scrap: number; cost: number; source: "gold" | "chest"; user: UserDto }>("/shop/scrap", { method: "POST", token, body: JSON.stringify({ amount, source }) }),
  repairShield: (token: string, id: string) => request<{ cost: number; hero: HeroDto; user: UserDto }>(`/heroes/${id}/shield/repair`, { method: "POST", token, body: "{}" }),
  upgradeShield: (token: string, id: string) => request<{ cost: number; hero: HeroDto; user: UserDto }>(`/heroes/${id}/shield/upgrade`, { method: "POST", token, body: "{}" }),
  mail: (token: string) => request<PlayerMailDto[]>("/mail", { token, cache: "no-store" }),
  claimMail: (token: string, id: string) => request<{ claimed: boolean; mail: PlayerMailDto; user: UserDto }>(`/mail/${id}/claim`, { token, method: "POST", body: "{}" }),
  fuseHeroes: (token: string, heroIds: string[], requestId: string) =>
    request<FusionResultDto>("/fusion", { method: "POST", token, body: JSON.stringify({ heroIds, requestId }) }),

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

  deploy: (token: string, body: { heroId?: string; all?: boolean; mode?: "all" | "over-half" }) =>
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

  setForgeAssignment: (token: string, heroId: string, assigned: boolean) =>
    request<import("../pages/types").WorldState>("/blacksmiths/forge", {
      method: "POST", token, body: JSON.stringify({ heroId, assigned }),
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

  setShieldRepair: (token: string, enabled: boolean) =>
    request<import("../pages/types").WorldState>("/porters/shield-repair", {
      method: "POST", token, body: JSON.stringify({ enabled }),
    }),

  setShieldRepairRarity: (token: string, rarity: import("@herobits/shared").HeroRarity, enabled: boolean) =>
    request<import("../pages/types").WorldState>("/porters/shield-repair/rarity", {
      method: "POST", token, body: JSON.stringify({ rarity, enabled }),
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

  marketCancel: (token: string, id: string) =>
    request<import("../pages/types").WorldState>("/market/cancel", {
      method: "POST",
      token,
      body: JSON.stringify({ id }),
    }),

  summonRanking: (token: string) =>
    request<import("../pages/types").SummonRanking>("/ranking/summons", { token, cache: "no-store" }),

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
