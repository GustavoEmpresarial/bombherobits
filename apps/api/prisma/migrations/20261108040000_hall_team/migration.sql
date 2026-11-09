ALTER TABLE "Hero" ADD COLUMN "active" BOOLEAN NOT NULL DEFAULT true;
CREATE TABLE "HallRetirement" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "heroId" TEXT NOT NULL,
  "requestKey" TEXT NOT NULL,
  "season" INTEGER NOT NULL,
  "rarity" "HeroRarity" NOT NULL,
  "glory" INTEGER NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "HallRetirement_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "HallRetirement_heroId_key" ON "HallRetirement"("heroId");
CREATE INDEX "HallRetirement_userId_season_idx" ON "HallRetirement"("userId", "season");
CREATE INDEX "HallRetirement_userId_requestKey_idx" ON "HallRetirement"("userId", "requestKey");
CREATE INDEX "HallRetirement_season_glory_idx" ON "HallRetirement"("season", "glory");
ALTER TABLE "HallRetirement" ADD CONSTRAINT "HallRetirement_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
CREATE TABLE "HallClaim" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "season" INTEGER NOT NULL,
  "milestone" INTEGER NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "HallClaim_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "HallClaim_userId_season_milestone_key" ON "HallClaim"("userId", "season", "milestone");
ALTER TABLE "HallClaim" ADD CONSTRAINT "HallClaim_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
