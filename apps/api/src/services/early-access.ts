import { prisma } from "../lib/prisma.js";

export const EARLY_ACCESS_MESSAGE = "The game is not open yet. Whitelist approval is required for early access.";
export const earlyAccessStore = {
  approved: (wallet: string) => prisma.whitelistApplication.findFirst({
    where: { wallet, status: "APPROVED" }, select: { id: true },
  }),
};
export async function hasGameAccess(wallet: string): Promise<boolean> {
  // Closed by default, including existing sessions. Social declarations alone never grant access.
  if (process.env.BMINER_EARLY_ACCESS_OPEN !== "true" || !wallet) return false;
  return Boolean(await earlyAccessStore.approved(wallet));
}
