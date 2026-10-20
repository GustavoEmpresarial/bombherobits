-- Persist recovery time and fractional stamina without changing existing hero balances.
ALTER TABLE "User" ADD COLUMN "staminaUpdatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE "Hero" ADD COLUMN "staminaRecoveryUnits" INTEGER NOT NULL DEFAULT 0;
