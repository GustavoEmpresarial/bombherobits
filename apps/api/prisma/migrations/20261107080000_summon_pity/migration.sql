ALTER TABLE "User" ADD COLUMN "summonPityRare" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "User" ADD COLUMN "summonPitySuperRare" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "User" ADD COLUMN "summonPityEpic" INTEGER NOT NULL DEFAULT 0;

-- Existing sealed, revealed and claimed summons all count: their outcomes were
-- already fixed at purchase time. Carry each player's trailing streak forward.
WITH pulls AS (
  SELECT batch."userId", card.value->>'rarity' AS rarity,
    ROW_NUMBER() OVER (PARTITION BY batch."userId"
      ORDER BY batch."createdAt", batch."id", card.ordinality) AS seq
  FROM "SummonBatch" AS batch
  CROSS JOIN LATERAL jsonb_array_elements(batch."rolls"::jsonb)
    WITH ORDINALITY AS card(value, ordinality)
), progress AS (
  SELECT "userId",
    LEAST(14, MAX(seq) - COALESCE(MAX(seq) FILTER (WHERE rarity = 'RARE'), 0))::integer AS rare,
    LEAST(49, MAX(seq) - COALESCE(MAX(seq) FILTER (WHERE rarity = 'SUPER_RARE'), 0))::integer AS super_rare,
    LEAST(99, MAX(seq) - COALESCE(MAX(seq) FILTER (WHERE rarity IN ('EPIC', 'LEGENDARY', 'SUPER_LEGENDARY')), 0))::integer AS epic
  FROM pulls GROUP BY "userId"
)
UPDATE "User" AS player SET
  "summonPityRare" = progress.rare,
  "summonPitySuperRare" = progress.super_rare,
  "summonPityEpic" = progress.epic
FROM progress WHERE player."id" = progress."userId";
