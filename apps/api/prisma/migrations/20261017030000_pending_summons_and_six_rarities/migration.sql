ALTER TYPE "HeroRarity" ADD VALUE IF NOT EXISTS 'SUPER_RARE';
ALTER TYPE "HeroRarity" ADD VALUE IF NOT EXISTS 'SUPER_LEGENDARY';
CREATE TYPE "SummonStatus" AS ENUM ('SEALED','REVEALED','CLAIMED');
CREATE TYPE "SummonSource" AS ENUM ('GOLD','CARDS');
CREATE TABLE "SummonBatch" (
 "id" TEXT NOT NULL PRIMARY KEY, "userId" TEXT NOT NULL,
 "source" "SummonSource" NOT NULL, "status" "SummonStatus" NOT NULL DEFAULT 'SEALED',
 "count" INTEGER NOT NULL, "cost" DECIMAL(18,2) NOT NULL,
 "requestKey" TEXT NOT NULL, "rolls" JSONB NOT NULL,
 "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 "revealedAt" TIMESTAMP(3), "claimedAt" TIMESTAMP(3),
 CONSTRAINT "SummonBatch_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "SummonBatch_userId_requestKey_key" ON "SummonBatch"("userId","requestKey");
CREATE INDEX "SummonBatch_userId_status_idx" ON "SummonBatch"("userId","status");
ALTER TABLE "Hero" ADD COLUMN "summonBatchId" TEXT;
ALTER TABLE "Hero" ADD CONSTRAINT "Hero_summonBatchId_fkey" FOREIGN KEY ("summonBatchId") REFERENCES "SummonBatch"("id") ON DELETE SET NULL ON UPDATE CASCADE;
UPDATE "RuntimeSettings" SET "data" = jsonb_set(
 jsonb_set("data",'{heroes,rarityWeights}','{"COMMON":82.87,"RARE":10.36,"SUPER_RARE":5.18,"EPIC":1.04,"LEGENDARY":0.51,"SUPER_LEGENDARY":0.04}'::jsonb),
 '{heroes,rarityMultipliers}',("data"#>'{heroes,rarityMultipliers}')||'{"SUPER_RARE":1.6,"SUPER_LEGENDARY":3.2}'::jsonb
), "revision"="revision"+1, "updatedAt"=CURRENT_TIMESTAMP
WHERE NOT (("data"#>'{heroes,rarityWeights}') ? 'SUPER_RARE');

ALTER TABLE "Hero" ADD COLUMN "summonSlot" INTEGER;
CREATE UNIQUE INDEX "Hero_summonBatchId_summonSlot_key" ON "Hero"("summonBatchId","summonSlot");
