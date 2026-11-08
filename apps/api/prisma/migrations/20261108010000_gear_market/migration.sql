ALTER TYPE "ListingKind" ADD VALUE 'GEAR';
ALTER TABLE "GearPiece" ADD COLUMN "listed" BOOLEAN NOT NULL DEFAULT false;
CREATE INDEX "GearPiece_userId_listed_idx" ON "GearPiece"("userId", "listed");
