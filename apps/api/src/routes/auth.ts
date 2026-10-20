import type { FastifyInstance } from "fastify";
import { randomBytes } from "node:crypto";
import { hasGameAccess, EARLY_ACCESS_MESSAGE } from "../services/early-access.js";
import { z } from "zod";
import { heroStats } from "../services/summon.js";
import { prisma } from "../lib/prisma.js";
import { shortWallet, toUserDto } from "../lib/mappers.js";
import {
  buildSignInMessage,
  isValidSolanaAddress,
  verifyWalletSignature,
} from "../lib/solana.js";

const walletSchema = z.object({
  wallet: z.string().min(32).max(64),
});

const verifySchema = z.object({
  wallet: z.string().min(32).max(64),
  signature: z.string().min(64),
  nonce: z.string().min(8),
});

import { getConfig,gameRules } from "../services/config.js";

async function grantStarterHeroes(userId: string) {
  const config=await getConfig();
  const starters=config.heroes.starters;

  for (const s of starters) {
    await prisma.hero.create({
      data: {
        userId,
        class: s.class,
        rarity: s.rarity,
        ...heroStats(s.class,s.rarity,config),
      },
    });
  }
}

export async function authRoutes(app: FastifyInstance) {
  app.post("/auth/nonce", async (request, reply) => {
    const config=await getConfig();const CHALLENGE_TTL_MS=config.auth.challengeTtlSeconds*1000;
    const parsed = walletSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: "Invalid wallet" });
    }

    const wallet = parsed.data.wallet.trim();
    if (!isValidSolanaAddress(wallet)) {
      return reply.code(400).send({ error: "Invalid Solana address" });
    }

    if (!await hasGameAccess(wallet)) return reply.code(403).send({ error: EARLY_ACCESS_MESSAGE, code: "EARLY_ACCESS_REQUIRED" });

    await prisma.authChallenge.deleteMany({
      where: { OR: [{ wallet }, { expiresAt: { lt: new Date() } }] },
    });

    const nonce = randomBytes(16).toString("hex");
    const issuedAt = new Date().toISOString();
    const message = buildSignInMessage(wallet, nonce, issuedAt);
    const expiresAt = new Date(Date.now() + CHALLENGE_TTL_MS);

    await prisma.authChallenge.create({
      data: { wallet, nonce, message, expiresAt },
    });

    return { nonce, message, expiresAt: expiresAt.toISOString() };
  });

  app.post("/auth/wallet", async (request, reply) => {
    const config=await getConfig();const {GAME}=gameRules(config);
    const parsed = verifySchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: "Invalid payload" });
    }

    const { wallet, signature, nonce } = parsed.data;
    if (!isValidSolanaAddress(wallet)) {
      return reply.code(400).send({ error: "Invalid Solana address" });
    }

    if (!await hasGameAccess(wallet)) return reply.code(403).send({ error: EARLY_ACCESS_MESSAGE, code: "EARLY_ACCESS_REQUIRED" });

    const challenge = await prisma.authChallenge.findUnique({ where: { nonce } });
    if (!challenge || challenge.wallet !== wallet) {
      return reply.code(401).send({ error: "Challenge not found" });
    }
    if (challenge.expiresAt.getTime() < Date.now()) {
      await prisma.authChallenge.delete({ where: { id: challenge.id } }).catch(() => {});
      return reply.code(401).send({ error: "Challenge expired" });
    }

    const ok = verifyWalletSignature(wallet, challenge.message, signature);
    if (!ok) {
      return reply.code(401).send({ error: "Invalid signature" });
    }

    await prisma.authChallenge.delete({ where: { id: challenge.id } }).catch(() => {});

    let user = await prisma.user.findUnique({ where: { wallet } });
    let isNew = false;
    if (!user) {
      isNew = true;
      user = await prisma.user.create({
        data: {
          wallet,
          displayName: shortWallet(wallet),
          gold: GAME.STARTING_GOLD,
          inviteCode: randomBytes(4).toString("hex"),
        },
      });
      await grantStarterHeroes(user.id);
    }

    const token = app.jwt.sign({ id: user.id, wallet: user.wallet },{expiresIn:config.auth.playerSessionHours*3600});
    return { token, user: toUserDto(user), isNew };
  });
}
