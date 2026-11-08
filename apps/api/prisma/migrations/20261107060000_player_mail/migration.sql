CREATE TABLE "PlayerMail" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "sourceKey" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "body" TEXT NOT NULL,
  "gold" DECIMAL(18,2) NOT NULL DEFAULT 0,
  "mintCards" INTEGER NOT NULL DEFAULT 0,
  "scrap" INTEGER NOT NULL DEFAULT 0,
  "claimedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PlayerMail_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "PlayerMail_sourceKey_key" ON "PlayerMail"("sourceKey");
CREATE INDEX "PlayerMail_userId_createdAt_idx" ON "PlayerMail"("userId", "createdAt");
ALTER TABLE "PlayerMail" ADD CONSTRAINT "PlayerMail_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
