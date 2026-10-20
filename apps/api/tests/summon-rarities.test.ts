import {test} from "node:test";
import assert from "node:assert/strict";
import {DEFAULT_CONFIG,HERO_RARITIES,RARITY_INFO} from "@herobits/shared";
import {rollHero,heroStats} from "../src/services/summon.js";
import {parseConfig} from "../src/services/config-validation.js";

test("all six rarities have odds, multipliers, colors and a distinct ranking",()=>{
 assert.equal(HERO_RARITIES.length,6);
 assert.equal(Object.values(DEFAULT_CONFIG.heroes.rarityWeights).reduce((a,b)=>a+Math.round(b*100),0),10000);
 assert.equal(new Set(HERO_RARITIES.map(r=>RARITY_INFO[r].rank)).size,6);
 assert.equal(new Set(HERO_RARITIES.map(r=>RARITY_INFO[r].color)).size,6);
 assert.deepEqual(Object.keys(parseConfig(DEFAULT_CONFIG).heroes.rarityWeights),[...HERO_RARITIES]);
});
for(const rarity of HERO_RARITIES)test("the server can actually mint "+rarity+" and skips zero-weight rarities",context=>{
 context.mock.method(Math,"random",()=>0);
 const config=structuredClone(DEFAULT_CONFIG);
 for(const key of HERO_RARITIES)config.heroes.rarityWeights[key]=key===rarity?100:0;
 const hero=rollHero(parseConfig(config));
 assert.equal(hero.rarity,rarity);
 assert.equal(hero.class,"WARRIOR");
 assert.equal(hero.atk,Math.round(config.heroes.classes.WARRIOR.atk*config.heroes.rarityMultipliers[rarity]));
});

for(const rarity of HERO_RARITIES)test("stamina boundaries for "+rarity+" are inclusive and independent of class",context=>{
 const config=structuredClone(DEFAULT_CONFIG);
 const range=config.stamina.rarityPoints[rarity];
 for(const heroClass of ["WARRIOR","MAGE","ROGUE"] as const){
  context.mock.method(Math,"random",()=>0);
  assert.equal(heroStats(heroClass,rarity,config).maxStamina,range.min*50);
  context.mock.method(Math,"random",()=>0.999999999);
  assert.equal(heroStats(heroClass,rarity,config).maxStamina,range.max*50);
 }
});
test("every configured stamina value can be minted without applying the attack multiplier",context=>{
 const config=structuredClone(DEFAULT_CONFIG);config.stamina.energyPerPoint=20;
 config.stamina.rarityPoints.SUPER_RARE={min:4,max:6};config.heroes.rarityMultipliers.SUPER_RARE=10;
 for(const [random,expected] of [[0,80],[0.5,100],[0.999999,120]]){
  context.mock.method(Math,"random",()=>random);
  const stats=heroStats("MAGE","SUPER_RARE",parseConfig(config));
  assert.equal(stats.maxStamina,expected);assert.equal(stats.stamina,expected);assert.equal(stats.atk,120);
 }
});
test("invalid stamina ranges, conversion units, fractions and missing rarities are refused",()=>{
 for(const patch of [{min:7,max:3},{min:0,max:3},{min:1.5,max:3},{min:1,max:1001}]){
  const config=structuredClone(DEFAULT_CONFIG);config.stamina.rarityPoints.COMMON=patch;assert.throws(()=>parseConfig(config));
 }
 for(const energyPerPoint of [0,-1,1.5,101])assert.throws(()=>parseConfig({...DEFAULT_CONFIG,stamina:{...DEFAULT_CONFIG.stamina,energyPerPoint}}));
 const config=structuredClone(DEFAULT_CONFIG);delete (config.stamina.rarityPoints as Partial<typeof config.stamina.rarityPoints>).RARE;assert.throws(()=>parseConfig(config));
});
