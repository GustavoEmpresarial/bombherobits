CREATE TABLE "CreatorApplication" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "platform" TEXT NOT NULL,
    "followers" TEXT NOT NULL,
    "channelUrl" TEXT NOT NULL,
    "language" TEXT NOT NULL,
    "about" TEXT NOT NULL,
    "wallet" TEXT,
    "disclosure" BOOLEAN NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reviewedAt" TIMESTAMP(3),
    CONSTRAINT "CreatorApplication_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "CreatorApplication_status_createdAt_idx" ON "CreatorApplication"("status", "createdAt");
CREATE INDEX "CreatorApplication_email_createdAt_idx" ON "CreatorApplication"("email", "createdAt");
