import { prisma } from "../lib/prisma.js";

const SEVEN_DAYS = 7 * 24 * 60 * 60 * 1000;
const SEASON_EPOCH = Date.UTC(2026, 0, 5);

type RankingRow = {
  userId: string;
  displayName: string;
  points: bigint;
  summons: bigint;
  rank: bigint;
};

export async function summonRanking(userId: string, now = new Date()) {
  const user = await prisma.user.findUniqueOrThrow({ where: { id: userId }, select: { wallet: true } });
  const demo = user.wallet.startsWith("demo:");
  const season = Math.floor((now.getTime() - SEASON_EPOCH) / SEVEN_DAYS);
  const start = new Date(SEASON_EPOCH + season * SEVEN_DAYS);
  const end = new Date(start.getTime() + SEVEN_DAYS);
  const rows = await prisma.$queryRaw<RankingRow[]>`
    WITH totals AS (
      SELECT b."userId", u."displayName",
        COUNT(*)::bigint AS summons,
        SUM(CASE card.value->>'rarity'
          WHEN 'COMMON' THEN 1
          WHEN 'RARE' THEN 3
          WHEN 'SUPER_RARE' THEN 8
          WHEN 'EPIC' THEN 20
          WHEN 'LEGENDARY' THEN 60
          WHEN 'SUPER_LEGENDARY' THEN 180
          ELSE 0 END)::bigint AS points
      FROM "SummonBatch" b
      JOIN "User" u ON u."id" = b."userId"
      CROSS JOIN LATERAL jsonb_array_elements(b."rolls") AS card(value)
      WHERE b."createdAt" >= ${start} AND b."createdAt" < ${end}
        AND (u."wallet" LIKE 'demo:%') = ${demo}
      GROUP BY b."userId", u."displayName"
    ), ranked AS (
      SELECT *, RANK() OVER (ORDER BY points DESC, summons DESC) AS rank
      FROM totals
    )
    SELECT * FROM ranked WHERE rank <= 50 OR "userId" = ${userId}
    ORDER BY rank ASC, "userId" ASC
  `;
  const mapped = rows.map(row => ({
    userId: row.userId,
    displayName: row.displayName,
    points: Number(row.points),
    summons: Number(row.summons),
    rank: Number(row.rank),
  }));
  return {
    season: season + 1,
    startsAt: start.toISOString(),
    endsAt: end.toISOString(),
    standings: mapped.filter(row => row.rank <= 50),
    me: mapped.find(row => row.userId === userId) ?? null,
  };
}
