CREATE TABLE "HallRaceClaim" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "season" INTEGER NOT NULL,
  "threshold" INTEGER NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "HallRaceClaim_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "HallRaceClaim_userId_season_threshold_key" ON "HallRaceClaim"("userId", "season", "threshold");
CREATE INDEX "HallRaceClaim_season_threshold_idx" ON "HallRaceClaim"("season", "threshold");
ALTER TABLE "HallRaceClaim" ADD CONSTRAINT "HallRaceClaim_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
