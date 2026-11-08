import { Prisma } from "@prisma/client";
import type { PlayerMailDto } from "@herobits/shared";
import { prisma } from "../lib/prisma.js";
import { toGold, toUserDto } from "../lib/mappers.js";

function toMailDto(mail: { id: string; title: string; body: string; gold: Prisma.Decimal; mintCards: number; scrap: number; claimedAt: Date | null; createdAt: Date }): PlayerMailDto {
  return { id: mail.id, title: mail.title, body: mail.body, gold: toGold(mail.gold), mintCards: mail.mintCards,
    scrap: mail.scrap, claimedAt: mail.claimedAt?.toISOString() ?? null, createdAt: mail.createdAt.toISOString() };
}

export async function listMail(userId: string): Promise<PlayerMailDto[]> {
  const rows = await prisma.playerMail.findMany({ where: { userId }, orderBy: { createdAt: "desc" }, take: 50 });
  return rows.map(toMailDto);
}

export async function claimMail(userId: string, mailId: string) {
  return prisma.$transaction(async tx => {
    await tx.$queryRaw`SELECT "id" FROM "User" WHERE "id" = ${userId} FOR UPDATE`;
    await tx.$queryRaw`SELECT "id" FROM "PlayerMail" WHERE "id" = ${mailId} FOR UPDATE`;
    const mail = await tx.playerMail.findFirst({ where: { id: mailId, userId } });
    if (!mail) throw Object.assign(new Error("Mail not found"), { statusCode: 404 });
    if (mail.claimedAt) {
      const user = await tx.user.findUniqueOrThrow({ where: { id: userId } });
      return { claimed: false, mail: toMailDto(mail), user: toUserDto(user) };
    }
    const claimed = await tx.playerMail.update({ where: { id: mail.id }, data: { claimedAt: new Date() } });
    const user = await tx.user.update({ where: { id: userId }, data: {
      gold: { increment: mail.gold }, mintCards: { increment: mail.mintCards }, scrap: { increment: mail.scrap },
    } });
    return { claimed: true, mail: toMailDto(claimed), user: toUserDto(user) };
  });
}
