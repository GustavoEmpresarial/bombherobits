export type MarketingConfig = {
  xUrl: string | null;
  discordUrl: string | null;
  contract: string | null;
  buyUrl: string | null;
  whitelistOpen: boolean;
};
export type WhitelistApplicationInput = {
  email: string;
  xHandle: string;
  discordUsername: string;
  wallet: string;
  followedX: boolean;
  joinedDiscord: boolean;
};
