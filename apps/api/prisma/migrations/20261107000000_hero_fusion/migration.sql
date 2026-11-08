CREATE TABLE "Fusion" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "requestKey" TEXT NOT NULL,
    "sourceIds" JSONB NOT NULL,
    "sourceRarity" "HeroRarity" NOT NULL,
    "resultRarity" "HeroRarity" NOT NULL,
    "resultHeroId" TEXT NOT NULL,
    "critical" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Fusion_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Fusion_userId_requestKey_key" ON "Fusion"("userId", "requestKey");
CREATE INDEX "Fusion_userId_createdAt_idx" ON "Fusion"("userId", "createdAt");
ALTER TABLE "Fusion" ADD CONSTRAINT "Fusion_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
