CREATE TABLE "GearBoxBatch" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "requestKey" TEXT NOT NULL,
  "box" "GearRarity" NOT NULL,
  "count" INTEGER NOT NULL,
  "source" TEXT NOT NULL,
  "totalCost" INTEGER NOT NULL,
  "results" JSONB NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "GearBoxBatch_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "GearBoxBatch_userId_requestKey_key" ON "GearBoxBatch"("userId", "requestKey");
ALTER TABLE "GearBoxBatch" ADD CONSTRAINT "GearBoxBatch_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
