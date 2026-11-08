import { test } from "node:test";
import assert from "node:assert/strict";
import { advanceSummonPity, EMPTY_SUMMON_PITY } from "@herobits/shared";

test("the 15th, 50th and 100th cards guarantee their exact rarity", () => {
  let pity = { ...EMPTY_SUMMON_PITY };
  const rarities = [];
  for (let index = 1; index <= 100; index++) {
    const next = advanceSummonPity("COMMON", pity);
    rarities.push(next.rarity);
    pity = next.pity;
  }
  assert.equal(rarities[14], "RARE");
  assert.equal(rarities[49], "SUPER_RARE");
  assert.equal(rarities[99], "EPIC");
  assert.deepEqual(pity, { rare: 10, superRare: 49, epic: 0 });
});

test("a higher simultaneous guarantee keeps the lower one due for the next card", () => {
  const first = advanceSummonPity("COMMON", { rare: 14, superRare: 49, epic: 99 });
  assert.equal(first.rarity, "EPIC");
  assert.deepEqual(first.pity, { rare: 14, superRare: 49, epic: 0 });
  const second = advanceSummonPity("COMMON", first.pity);
  assert.equal(second.rarity, "SUPER_RARE");
  const third = advanceSummonPity("COMMON", second.pity);
  assert.equal(third.rarity, "RARE");
});

test("natural matching pulls reset their own bar, and high rarities reset Epic", () => {
  const rare = advanceSummonPity("RARE", { rare: 8, superRare: 10, epic: 20 });
  assert.deepEqual(rare.pity, { rare: 0, superRare: 11, epic: 21 });
  const legend = advanceSummonPity("LEGENDARY", { rare: 2, superRare: 3, epic: 60 });
  assert.deepEqual(legend.pity, { rare: 3, superRare: 4, epic: 0 });
});
