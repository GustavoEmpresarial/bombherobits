import { test } from "node:test";
import assert from "node:assert/strict";
import { HERO_SKILLS } from "@herobits/shared";
import { rollHeroSkills } from "../src/services/hero-skills.js";

test("each rarity has unique skills and higher rarities have more", () => {
  const rarities = ["COMMON", "RARE", "SUPER_RARE", "EPIC", "LEGENDARY", "SUPER_LEGENDARY"] as const;
  for (const [index, rarity] of rarities.entries()) {
    const skills = rollHeroSkills(rarity, () => 0.5);
    assert.equal(skills.length, index + 1);
    assert.equal(new Set(skills).size, skills.length);
    assert(skills.every((skill) => HERO_SKILLS.includes(skill)));
  }
});
