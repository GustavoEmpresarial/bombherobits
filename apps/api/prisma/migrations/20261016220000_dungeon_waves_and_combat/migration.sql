-- Keep existing runs and their targets; start tracking completed waves and confirmed hits.
ALTER TABLE "DungeonRun"
  ADD COLUMN "wave" INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN "waveTotal" INTEGER NOT NULL DEFAULT 40,
  ADD COLUMN "openedCrates" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "combatSequence" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "combatEvents" JSONB NOT NULL DEFAULT '[]';
UPDATE "DungeonRun" AS run SET "waveTotal" = counts.total
FROM (SELECT "runId", count(*)::integer AS total FROM "DungeonTarget" GROUP BY "runId") AS counts
WHERE run."id" = counts."runId";
