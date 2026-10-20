export const CREATOR_PLATFORMS = ["YouTube", "Twitch", "TikTok", "Instagram", "X", "Kick", "Other"] as const;
export const CREATOR_FOLLOWERS = ["Under 1,000", "1,000–9,999", "10,000–49,999", "50,000–99,999", "100,000+"] as const;
export const CREATOR_LANGUAGES = ["English", "Portuguese", "Spanish", "French", "German", "Japanese", "Korean", "Other"] as const;
export type CreatorApplicationInput = {
  name: string;
  email: string;
  platform: typeof CREATOR_PLATFORMS[number];
  followers: typeof CREATOR_FOLLOWERS[number];
  channelUrl: string;
  language: typeof CREATOR_LANGUAGES[number];
  about: string;
  wallet: string;
  disclosure: boolean;
};
