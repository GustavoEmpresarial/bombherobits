-- CreateEnum
CREATE TYPE "ListingKind" AS ENUM ('HERO', 'BLACKSMITH', 'PORTER');

-- CreateEnum
CREATE TYPE "ListingStatus" AS ENUM ('OPEN', 'SOLD', 'CANCELLED');

-- AlterEnum
ALTER TYPE "HeroStatus" ADD VALUE 'LISTED';

-- DropIndex
DROP INDEX "User_email_key";

-- AlterTable
ALTER TABLE "User" DROP COLUMN "email",
DROP COLUMN "passwordHash",
ADD COLUMN     "chest" DECIMAL(18,2) NOT NULL DEFAULT 0,
ADD COLUMN     "inviteCode" TEXT,
ADD COLUMN     "mintCards" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "porterOn" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "referredBy" TEXT,
ADD COLUMN     "wallet" TEXT NOT NULL;

-- CreateTable
CREATE TABLE "Blacksmith" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "tier" INTEGER NOT NULL,
    "inService" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Blacksmith_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Porter" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Porter_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Listing" (
    "id" TEXT NOT NULL,
    "sellerId" TEXT NOT NULL,
    "kind" "ListingKind" NOT NULL,
    "refId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "price" DECIMAL(18,2) NOT NULL,
    "status" "ListingStatus" NOT NULL DEFAULT 'OPEN',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Listing_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuthChallenge" (
    "id" TEXT NOT NULL,
    "wallet" TEXT NOT NULL,
    "nonce" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuthChallenge_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Blacksmith_userId_idx" ON "Blacksmith"("userId");

-- CreateIndex
CREATE INDEX "Porter_userId_idx" ON "Porter"("userId");

-- CreateIndex
CREATE INDEX "Listing_status_kind_idx" ON "Listing"("status", "kind");

-- CreateIndex
CREATE INDEX "Listing_sellerId_idx" ON "Listing"("sellerId");

-- CreateIndex
CREATE UNIQUE INDEX "AuthChallenge_nonce_key" ON "AuthChallenge"("nonce");

-- CreateIndex
CREATE INDEX "AuthChallenge_wallet_idx" ON "AuthChallenge"("wallet");

-- CreateIndex
CREATE UNIQUE INDEX "User_wallet_key" ON "User"("wallet");

-- CreateIndex
CREATE UNIQUE INDEX "User_inviteCode_key" ON "User"("inviteCode");

-- AddForeignKey
ALTER TABLE "Blacksmith" ADD CONSTRAINT "Blacksmith_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Porter" ADD CONSTRAINT "Porter_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Listing" ADD CONSTRAINT "Listing_sellerId_fkey" FOREIGN KEY ("sellerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
