CREATE TYPE "GearSlot" AS ENUM ('HELM', 'ARMOR', 'BOOTS');
CREATE TYPE "GearElement" AS ENUM ('FIRE', 'STORM', 'FROST');
CREATE TYPE "GearRarity" AS ENUM ('STEEL', 'GREEN', 'BLUE', 'PURPLE', 'GOLD');

CREATE TABLE "GearPiece" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "heroId" TEXT,
  "slot" "GearSlot" NOT NULL,
  "element" "GearElement" NOT NULL,
  "rarity" "GearRarity" NOT NULL,
  "attack" INTEGER NOT NULL,
  "shield" INTEGER NOT NULL,
  "shieldMax" INTEGER NOT NULL,
  "lastHeroId" TEXT,
  "movedDay" DATE,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "GearPiece_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "GearPiece_heroId_slot_key" ON "GearPiece"("heroId", "slot");
CREATE INDEX "GearPiece_userId_heroId_idx" ON "GearPiece"("userId", "heroId");
ALTER TABLE "GearPiece" ADD CONSTRAINT "GearPiece_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "GearPiece" ADD CONSTRAINT "GearPiece_heroId_fkey" FOREIGN KEY ("heroId") REFERENCES "Hero"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "GearPurchase" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "requestKey" TEXT NOT NULL,
  "pieceId" TEXT,
  "cost" INTEGER NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "GearPurchase_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "GearPurchase_userId_requestKey_key" ON "GearPurchase"("userId", "requestKey");
ALTER TABLE "GearPurchase" ADD CONSTRAINT "GearPurchase_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "GearPurchase" ADD CONSTRAINT "GearPurchase_pieceId_fkey" FOREIGN KEY ("pieceId") REFERENCES "GearPiece"("id") ON DELETE SET NULL ON UPDATE CASCADE;
