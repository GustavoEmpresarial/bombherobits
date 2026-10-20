-- Retain fractional work time across pauses and restarts without changing existing stamina.
ALTER TABLE "Hero" ADD COLUMN "staminaUsageUnits" INTEGER NOT NULL DEFAULT 0;
