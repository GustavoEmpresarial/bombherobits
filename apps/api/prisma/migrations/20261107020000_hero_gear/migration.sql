ALTER TABLE "User" ADD COLUMN "scrap" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "Hero" ADD COLUMN "shield" INTEGER NOT NULL DEFAULT 600;
ALTER TABLE "Hero" ADD COLUMN "shieldMax" INTEGER NOT NULL DEFAULT 600;
ALTER TABLE "Hero" ADD COLUMN "shieldLevel" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "Hero" ADD COLUMN "skills" JSONB NOT NULL DEFAULT '[]'::jsonb;

UPDATE "Hero" AS hero SET "skills" = (
  SELECT COALESCE(jsonb_agg(chosen.skill), '[]'::jsonb)
  FROM (
    SELECT skill FROM unnest(ARRAY['blacksmith','precision','enemyDamage','bossDamage','fury','execute','swift']) AS skill
    ORDER BY md5(hero.id || skill)
    LIMIT CASE hero.rarity
      WHEN 'COMMON' THEN 1 WHEN 'RARE' THEN 2 WHEN 'SUPER_RARE' THEN 3
      WHEN 'EPIC' THEN 4 WHEN 'LEGENDARY' THEN 5 ELSE 6 END
  ) AS chosen
);
