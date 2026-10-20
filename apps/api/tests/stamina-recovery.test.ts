import { test } from "node:test";
import assert from "node:assert/strict";
import { advanceRecovery, RECOVERY_UNITS_PER_POINT, type RecoveryHero } from "../src/services/stamina-recovery.js";

const at = (ms: number) => new Date(ms);
function hero(id: string, stamina = 0, maxStamina = 10): RecoveryHero {
  return { id, stamina, maxStamina, staminaRecoveryUnits: 0, createdAt: at(0) };
}

test("resting recovers one point every two minutes", () => {
  const [row] = advanceRecovery([hero("a")], at(0), at(120_000));
  assert.equal(row.stamina, 1);
  assert.equal(row.staminaRecoveryUnits, 0);
});
test("frequent updates keep fractional progress and match one offline update", () => {
  let rows = [hero("a")];
  for (let i = 0; i < 1200; i++) rows = advanceRecovery(rows, at(i * 100), at((i + 1) * 100));
  assert.deepEqual(rows, advanceRecovery([hero("a")], at(0), at(120_000)));
});
test("recovery caps at max and cannot bank extra stamina", () => {
  const [row] = advanceRecovery([hero("a", 9)], at(0), at(86_400_000));
  assert.equal(row.stamina, 10);
  assert.equal(row.staminaRecoveryUnits, 0);
});
test("forge boosts only available slots while other heroes keep base recovery", () => {
  const rows = advanceRecovery([hero("a"), hero("b")], at(0), at(120_000), { slots: 1, rate: 2 });
  assert.equal(rows[0].stamina, 4);
  assert.equal(rows[1].stamina, 1);
});
test("a full hero releases its forge slot during an offline interval", () => {
  const rows = advanceRecovery([hero("a", 9), hero("b")], at(0), at(60_000), { slots: 1, rate: 2 });
  assert.equal(rows[0].stamina, 10);
  assert.equal(rows[1].stamina, 1);
  assert.equal(rows[1].staminaRecoveryUnits, 30_000);
});
test("new heroes get no recovery before their creation time", () => {
  const newborn = { ...hero("a"), createdAt: at(60_000) };
  const [row] = advanceRecovery([newborn], at(0), at(120_000));
  assert.equal(row.stamina, 0);
  assert.equal(row.staminaRecoveryUnits, 60_000);
});
test("changing recovery rate preserves previously earned fractions", () => {
  const base = advanceRecovery([hero("a")], at(0), at(60_000));
  const [row] = advanceRecovery(base, at(60_000), at(120_000), { slots: 1, rate: 2 });
  assert.equal(row.stamina, 2);
  assert.equal(row.staminaRecoveryUnits, RECOVERY_UNITS_PER_POINT / 2);
});
test("same timestamp, backwards clocks and empty parties add nothing", () => {
  const rows = [hero("a")];
  assert.deepEqual(advanceRecovery(rows, at(20), at(10)), rows);
  assert.deepEqual(advanceRecovery(rows, at(20), at(20)), rows);
  assert.deepEqual(advanceRecovery([], at(0), at(1e12)), []);
});
