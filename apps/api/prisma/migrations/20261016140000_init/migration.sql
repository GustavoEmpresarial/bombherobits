-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "HeroClass" AS ENUM ('WARRIOR', 'MAGE', 'ROGUE');

-- CreateEnum
CREATE TYPE "HeroRarity" AS ENUM ('COMMON', 'RARE', 'EPIC', 'LEGENDARY');

-- CreateEnum
CREATE TYPE "HeroStatus" AS ENUM ('IDLE', 'HUNTING');

-- CreateEnum
CREATE TYPE "TargetType" AS ENUM ('SLIME', 'BLOCK');

-- CreateEnum
CREATE TYPE "DungeonRunStatus" AS ENUM ('ACTIVE', 'ENDED');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "gold" DECIMAL(18,2) NOT NULL DEFAULT 500,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Hero" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "class" "HeroClass" NOT NULL,
    "rarity" "HeroRarity" NOT NULL,
    "level" INTEGER NOT NULL DEFAULT 1,
    "atk" INTEGER NOT NULL,
    "spd" INTEGER NOT NULL,
    "stamina" INTEGER NOT NULL,
    "maxStamina" INTEGER NOT NULL,
    "status" "HeroStatus" NOT NULL DEFAULT 'IDLE',
    "dungeonX" INTEGER,
    "dungeonY" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Hero_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DungeonRun" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "status" "DungeonRunStatus" NOT NULL DEFAULT 'ACTIVE',
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastTickAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endedAt" TIMESTAMP(3),

    CONSTRAINT "DungeonRun_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DungeonTarget" (
    "id" TEXT NOT NULL,
    "runId" TEXT NOT NULL,
    "type" "TargetType" NOT NULL,
    "hp" INTEGER NOT NULL,
    "maxHp" INTEGER NOT NULL,
    "x" INTEGER NOT NULL,
    "y" INTEGER NOT NULL,

    CONSTRAINT "DungeonTarget_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RewardLog" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "amount" DECIMAL(18,2) NOT NULL,
    "source" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RewardLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "Hero_userId_idx" ON "Hero"("userId");

-- CreateIndex
CREATE INDEX "Hero_userId_status_idx" ON "Hero"("userId", "status");

-- CreateIndex
CREATE INDEX "DungeonRun_userId_status_idx" ON "DungeonRun"("userId", "status");

-- CreateIndex
CREATE INDEX "DungeonTarget_runId_idx" ON "DungeonTarget"("runId");

-- CreateIndex
CREATE UNIQUE INDEX "DungeonTarget_runId_x_y_key" ON "DungeonTarget"("runId", "x", "y");

-- CreateIndex
CREATE INDEX "RewardLog_userId_idx" ON "RewardLog"("userId");

-- AddForeignKey
ALTER TABLE "Hero" ADD CONSTRAINT "Hero_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DungeonRun" ADD CONSTRAINT "DungeonRun_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DungeonTarget" ADD CONSTRAINT "DungeonTarget_runId_fkey" FOREIGN KEY ("runId") REFERENCES "DungeonRun"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RewardLog" ADD CONSTRAINT "RewardLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

