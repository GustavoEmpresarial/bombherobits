import type { HeroClass, HeroRarity, UserDto } from "@herobits/shared";

export type WorldState = {
  user: UserDto;
  blacksmiths: { id: string; tier: number; name: string; inService: boolean }[];
  serviceName: string | null;
  forgeHeroIds: string[];
  porters: number;
  porterItems: { id: string }[];
  porterOn: boolean;
  shieldRepairOn: boolean;
  shieldRepairRarities: HeroRarity[];
  listings: {
    id: string;
    kind: string;
    title: string;
    price: number;
    seller: string;
    mine: boolean;
    heroClass: HeroClass | null;
  }[];
  myListings: { id: string; kind: string; refId: string; title: string; price: number; heroClass: HeroClass | null }[];
  catalog: { tier: number; name: string; slots: number; rate: number; price: number }[];
  economy: {
    PORTER_PRICE: number;
    MARKET_FEE: number;
    WITHDRAW_MIN: number;
    WITHDRAW_FEE: number;
    MINT_PACKS: number[];
    MAX_ACTIVE: number;
  };
};

export type SummonRanking = {
  season: number;
  startsAt: string;
  endsAt: string;
  standings: { userId: string; displayName: string; points: number; summons: number; rank: number }[];
  me: { userId: string; displayName: string; points: number; summons: number; rank: number } | null;
};
