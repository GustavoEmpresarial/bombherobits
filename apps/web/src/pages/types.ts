import type { UserDto } from "@herobits/shared";

export type WorldState = {
  user: UserDto;
  blacksmiths: { id: string; tier: number; name: string; inService: boolean }[];
  serviceName: string | null;
  porters: number;
  porterOn: boolean;
  listings: {
    id: string;
    kind: string;
    title: string;
    price: number;
    seller: string;
    mine: boolean;
  }[];
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
