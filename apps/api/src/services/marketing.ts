import { PublicKey } from "@solana/web3.js";
import type { MarketingConfig } from "@herobits/shared";
import { z } from "zod";
const officialLink = (value: string | undefined, hosts: string[]) => {
  try {
    const url = new URL(value ?? "");
    return url.protocol === "https:" && !url.username && !url.password && hosts.includes(url.hostname) && url.pathname.length > 1 ? url.href : null;
  } catch { return null; }
};
export function marketingConfig(env: NodeJS.ProcessEnv = process.env): MarketingConfig {
  const xUrl = officialLink(env.BMINER_X_URL, ["x.com", "www.x.com", "twitter.com", "www.twitter.com"]);
  const discordUrl = officialLink(env.BMINER_DISCORD_URL, ["discord.gg", "discord.com", "www.discord.com"]);
  let contract: string | null = null;
  try { if (env.BMINER_CONTRACT) contract = new PublicKey(env.BMINER_CONTRACT).toBase58(); } catch {}
  return { xUrl, discordUrl, contract, buyUrl: contract ? officialLink(env.BMINER_BUY_URL, ["pump.fun", "www.pump.fun"]) : null, whitelistOpen: Boolean(xUrl && discordUrl && env.BMINER_WHITELIST_OPEN === "true") };
}
export const whitelistSchema = z.object({
  email: z.string().trim().email().max(254).transform(value => value.toLowerCase()),
  xHandle: z.string().trim().transform(value => value.replace(/^@/, "").toLowerCase()).pipe(z.string().regex(/^[a-z0-9_]{1,15}$/)),
  discordUsername: z.string().trim().toLowerCase().min(2).max(32).regex(/^[a-z0-9_.]+$/),
  wallet: z.string().trim().max(44).refine(value => { if (!value) return true; try { return new PublicKey(value).toBase58() === value; } catch { return false; } }),
  followedX: z.literal(true),
  joinedDiscord: z.literal(true),
}).strict();
