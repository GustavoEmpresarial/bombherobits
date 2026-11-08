import assert from "node:assert/strict";
import test from "node:test";
import { recoverSkilledShield } from "../src/services/shield-recovery.js";

test("Quick Repair restores a quarter shield point each minute, including saved fractions", () => {
  const first = recoverSkilledShield(0, 600, 0, 60_000);
  assert.deepEqual(first, { shield: 0, shieldRecoveryUnits: 60_000 });
  const second = recoverSkilledShield(first.shield, 600, first.shieldRecoveryUnits, 180_000);
  assert.deepEqual(second, { shield: 1, shieldRecoveryUnits: 0 });
  assert.deepEqual(recoverSkilledShield(598, 600, 0, 8 * 60_000), { shield: 600, shieldRecoveryUnits: 0 });
});
