CREATE TABLE "WhitelistApplication" (
  "id" TEXT NOT NULL,
  "email" TEXT NOT NULL,
  "xHandle" TEXT NOT NULL,
  "discordUsername" TEXT NOT NULL,
  "wallet" TEXT,
  "followedX" BOOLEAN NOT NULL,
  "joinedDiscord" BOOLEAN NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'PENDING',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "reviewedAt" TIMESTAMP(3),
  CONSTRAINT "WhitelistApplication_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "WhitelistApplication_status_createdAt_idx" ON "WhitelistApplication"("status", "createdAt");
CREATE UNIQUE INDEX "WhitelistApplication_email_key" ON "WhitelistApplication"("email");
CREATE UNIQUE INDEX "WhitelistApplication_xHandle_key" ON "WhitelistApplication"("xHandle");
CREATE UNIQUE INDEX "WhitelistApplication_discordUsername_key" ON "WhitelistApplication"("discordUsername");
