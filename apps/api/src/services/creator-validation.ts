import { z } from "zod";
import { PublicKey } from "@solana/web3.js";
import { CREATOR_PLATFORMS, CREATOR_FOLLOWERS, CREATOR_LANGUAGES } from "@herobits/shared";

export const creatorApplicationSchema = z.object({
  name: z.string().trim().min(2).max(80),
  email: z.string().trim().email().max(254).transform(value => value.toLowerCase()),
  platform: z.enum(CREATOR_PLATFORMS),
  followers: z.enum(CREATOR_FOLLOWERS),
  channelUrl: z.string().trim().max(500).url().refine(value => {
    const url = new URL(value);
    return ["https:", "http:"].includes(url.protocol) && !url.username && !url.password;
  }, "Enter a public HTTP or HTTPS channel link."),
  language: z.enum(CREATOR_LANGUAGES),
  about: z.string().trim().min(20).max(2000),
  wallet: z.string().trim().max(44).refine(value => {
    if (!value) return true;
    try { return new PublicKey(value).toBase58() === value; } catch { return false; }
  }, "Enter a valid Solana wallet address."),
  disclosure: z.literal(true),
}).strict();
