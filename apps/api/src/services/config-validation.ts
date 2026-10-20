import { z } from "zod";
import { DEFAULT_CONFIG, LOOT_KINDS, type RuntimeConfig } from "@herobits/shared";
const positive=z.number().finite().positive();const money=z.number().finite().min(0).max(1e9).multipleOf(0.01);const count=z.number().int().min(0).max(10000);const name=z.string().trim().min(1).max(80);
const classRule=z.object({atk:positive.max(100000).int(),spd:positive.max(8).int(),range:positive.max(8).int()}).strict();
const rarities=<T extends z.ZodTypeAny>(rule:T)=>z.object({COMMON:rule,RARE:rule,SUPER_RARE:rule,EPIC:rule,LEGENDARY:rule,SUPER_LEGENDARY:rule}).strict();
const staminaRange=z.object({min:positive.max(1000).int(),max:positive.max(1000).int()}).strict().refine(v=>v.min<=v.max,"Minimum stamina cannot exceed maximum stamina");
const crate=z.object({name,maxHp:positive.max(1e7).int(),reward:money,weight:z.number().finite().min(0).max(10000)}).strict();
export const configSchema=z.object({
 game:z.object({MAX_WORKING_HEROES:positive.max(50).int(),TICK_MS:z.number().int().min(200).max(5000),OFFLINE_CAP_HOURS:z.number().finite().positive().max(24),TARGET_COUNT:positive.max(200).int()}).strict(),
 stamina:z.object({recoveryPerMinute:positive.max(10000).multipleOf(0.5),usagePerMinute:positive.max(10000).multipleOf(0.5),energyPerPoint:positive.max(100).int(),rarityPoints:rarities(staminaRange)}).strict(),
 heroes:z.object({startingGold:money,summonCost:money,summonPacks:z.array(positive.max(50).int()).min(1).max(10).refine(v=>new Set(v).size===v.length,"Pack sizes must be unique"),classes:z.object({WARRIOR:classRule,MAGE:classRule,ROGUE:classRule}).strict(),rarityWeights:rarities(z.number().finite().min(0).max(100)).refine(v=>Math.abs(Object.values(v).reduce((a,b)=>a+b,0)-100)<0.0001,"Rarity probabilities must total 100%"),rarityMultipliers:rarities(positive.max(20)),starters:z.array(z.object({class:z.enum(["WARRIOR","MAGE","ROGUE"]),rarity:z.enum(["COMMON","RARE","SUPER_RARE","EPIC","LEGENDARY","SUPER_LEGENDARY"])}).strict()).max(15)}).strict(),
 crates:z.object({"wooden-crate":crate,"iron-crate":crate,"gold-chest":crate,"crystal-chest":crate,"ancient-vault":crate}).strict().refine(v=>LOOT_KINDS.reduce((n,k)=>n+v[k].weight,0)>0,"At least one chest must have a positive spawn weight"),
 blacksmiths:z.array(z.object({tier:positive.max(6).int(),name,slots:positive.max(50).int(),rate:positive.max(10000).multipleOf(0.5),price:money}).strict()).length(6).refine(v=>v.every((row,i)=>row.tier===i+1),"Keep blacksmith tiers in order from 1 to 6"),
 economy:z.object({PORTER_PRICE:money,MARKET_FEE:z.number().finite().min(0).max(1),WITHDRAW_MIN:money.positive(),WITHDRAW_FEE:z.number().finite().min(0).max(1),MINT_PACKS:z.array(positive.max(50).int()).min(1).max(10).refine(v=>new Set(v).size===v.length,"Pack sizes must be unique"),MAX_ACTIVE:positive.max(500).int()}).strict(),
 referrals:z.object({hostCards:count,guestCards:count}).strict(),auth:z.object({challengeTtlSeconds:z.number().int().min(60).max(1800),playerSessionHours:z.number().int().min(1).max(168)}).strict(),
 visual:z.object({crateScale:z.number().min(0.2).max(1),heroScale:z.number().min(0.5).max(1.5),effectsEnabled:z.boolean()}).strict(),
 launch:z.object({date:z.string().datetime(),enabled:z.boolean()}).strict()
}).strict().refine(v=>v.game.MAX_WORKING_HEROES<=v.economy.MAX_ACTIVE,"The working hero limit cannot exceed the roster limit").refine(v=>v.heroes.starters.length<=v.economy.MAX_ACTIVE,"Starting heroes exceed the roster limit");
export function parseConfig(value:unknown):RuntimeConfig { return configSchema.parse(value) as RuntimeConfig; }
export function mergeConfig(value:unknown):RuntimeConfig { return parseConfig({...structuredClone(DEFAULT_CONFIG),...(value as object)}); }
