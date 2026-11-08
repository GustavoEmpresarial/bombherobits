ALTER TABLE "Hero" ALTER COLUMN "shield" SET DEFAULT 6000;
ALTER TABLE "Hero" ALTER COLUMN "shieldMax" SET DEFAULT 6000;
ALTER TABLE "Hero" ALTER COLUMN "shieldLevel" SET DEFAULT 1;

-- Preserve each existing hero's shield percentage while converting the old
-- universal capacity and zero-based level to rarity-based, one-based tiers.
WITH tiers AS (
  SELECT "id",
    LEAST(4, "shieldLevel" + 1) AS next_level,
    CASE "rarity"::text
      WHEN 'COMMON' THEN 6000
      WHEN 'RARE' THEN 18000
      WHEN 'SUPER_RARE' THEN 30000
      WHEN 'EPIC' THEN 54000
      WHEN 'LEGENDARY' THEN 90000
      WHEN 'SUPER_LEGENDARY' THEN 120000
    END AS base_capacity
  FROM "Hero"
)
UPDATE "Hero" AS hero SET
  "shield" = GREATEST(0, LEAST(tiers.base_capacity * tiers.next_level,
    ROUND(hero."shield"::numeric / GREATEST(hero."shieldMax", 1) * tiers.base_capacity * tiers.next_level)::integer)),
  "shieldMax" = tiers.base_capacity * tiers.next_level,
  "shieldLevel" = tiers.next_level
FROM tiers WHERE hero."id" = tiers."id";
