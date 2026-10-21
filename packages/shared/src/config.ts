import type { HeroClass, HeroRarity } from "./index.js";
export const LOOT_KINDS = ["wooden-crate", "iron-crate", "gold-chest", "crystal-chest", "ancient-vault"] as const;
export type LootKind = typeof LOOT_KINDS[number];
export type RuntimeConfig = {
  game: { MAX_WORKING_HEROES:number; TICK_MS:number; OFFLINE_CAP_HOURS:number; TARGET_COUNT:number };
  stamina: { recoveryPerMinute:number; usagePerMinute:number; energyPerPoint:number; rarityPoints:Record<HeroRarity,{min:number;max:number}> };
  heroes: { startingGold:number; summonCost:number; summonPacks:number[]; classes:Record<HeroClass,{atk:number;spd:number;range:number}>; rarityWeights:Record<HeroRarity,number>; rarityMultipliers:Record<HeroRarity,number>; starters:{class:HeroClass;rarity:HeroRarity}[] };
  crates: Record<LootKind,{name:string;maxHp:number;reward:number;weight:number}>;
  blacksmiths: {tier:number;name:string;slots:number;rate:number;price:number}[];
  economy: {PORTER_PRICE:number;MARKET_FEE:number;WITHDRAW_MIN:number;WITHDRAW_FEE:number;MINT_PACKS:number[];MAX_ACTIVE:number};
  referrals: { hostCards:number; guestCards:number };
  auth: { challengeTtlSeconds:number; playerSessionHours:number };
  visual: { crateScale:number; heroScale:number; effectsEnabled:boolean };
  launch: { date:string; enabled:boolean };
};
export type ConfigSection = keyof RuntimeConfig;
export const DEFAULT_CONFIG: RuntimeConfig = {
  game:{MAX_WORKING_HEROES:15,TICK_MS:1000,OFFLINE_CAP_HOURS:8,TARGET_COUNT:60},
  stamina:{recoveryPerMinute:0.5,usagePerMinute:4,energyPerPoint:50,rarityPoints:{COMMON:{min:1,max:3},RARE:{min:3,max:6},SUPER_RARE:{min:6,max:9},EPIC:{min:9,max:12},LEGENDARY:{min:12,max:15},SUPER_LEGENDARY:{min:15,max:18}}},
  heroes:{startingGold:500,summonCost:100,summonPacks:[1,5,10,15],classes:{WARRIOR:{atk:8,spd:1,range:1},MAGE:{atk:12,spd:1,range:3},ROGUE:{atk:6,spd:2,range:2}},rarityWeights:{COMMON:82.87,RARE:10.36,SUPER_RARE:5.18,EPIC:1.04,LEGENDARY:0.51,SUPER_LEGENDARY:0.04},rarityMultipliers:{COMMON:1,RARE:1.35,SUPER_RARE:1.6,EPIC:1.8,LEGENDARY:2.5,SUPER_LEGENDARY:3.2},starters:[{class:"WARRIOR",rarity:"COMMON"},{class:"MAGE",rarity:"RARE"},{class:"ROGUE",rarity:"COMMON"}]},
  crates:{"wooden-crate":{name:"Wooden Crate",maxHp:80,reward:50,weight:40},"iron-crate":{name:"Iron Crate",maxHp:250,reward:125,weight:24},"gold-chest":{name:"Gold Chest",maxHp:500,reward:250,weight:19},"crystal-chest":{name:"Crystal Chest",maxHp:750,reward:375,weight:9},"ancient-vault":{name:"Ancient Vault",maxHp:1000,reward:500,weight:8}},
  blacksmiths:[{tier:1,name:"Apprentice Smith",slots:4,rate:2,price:400},{tier:2,name:"Journeyman Smith",slots:6,rate:5,price:900},{tier:3,name:"Artisan Smith",slots:8,rate:8,price:1600},{tier:4,name:"Master Smith",slots:10,rate:11,price:2800},{tier:5,name:"Grandmaster Smith",slots:12,rate:14,price:4500},{tier:6,name:"Legendary Smith",slots:14,rate:17,price:7000}],
  economy:{PORTER_PRICE:600,MARKET_FEE:0.05,WITHDRAW_MIN:50,WITHDRAW_FEE:0.03,MINT_PACKS:[1,5,10],MAX_ACTIVE:50},
  referrals:{hostCards:1,guestCards:1},auth:{challengeTtlSeconds:300,playerSessionHours:24},visual:{crateScale:0.6,heroScale:1,effectsEnabled:true},launch:{date:"2026-10-25T04:00:00.000Z",enabled:true}
};
