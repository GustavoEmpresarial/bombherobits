import { DEFAULT_CONFIG, GAME, type RuntimeConfig, type ConfigSection } from "@herobits/shared";
import type { Prisma } from "@prisma/client";
import { prisma } from "../lib/prisma.js";
import { parseConfig } from "./config-validation.js";
let cached:{id:string;data:RuntimeConfig;revision:number;until:number}|null=null;
const settingsId=()=>process.env.HEROBITS_CONFIG_ID??"active";
export function peekConfig():RuntimeConfig {return cached?.id===settingsId()?cached.data:structuredClone(DEFAULT_CONFIG);}
export async function getSettings(){
 const id=settingsId();if(cached?.id===id&&cached.until>Date.now())return {config:cached.data,revision:cached.revision};
 const row=await prisma.runtimeSettings.upsert({where:{id},create:{id,data:DEFAULT_CONFIG as unknown as Prisma.InputJsonValue},update:{}});
 const data=parseConfig(row.data);cached={id,data,revision:row.revision,until:Date.now()+1000};return {config:data,revision:row.revision};
}
export async function getConfig(){return (await getSettings()).config;}
export function gameRules(config:RuntimeConfig=peekConfig()){
 return {GAME:{...GAME,...config.game,SUMMON_COST:config.heroes.summonCost,STARTING_GOLD:config.heroes.startingGold,STAMINA_RECOVERY_PER_MINUTE:config.stamina.recoveryPerMinute,STAMINA_USAGE_PER_MINUTE:config.stamina.usagePerMinute},ECONOMY:config.economy,BLACKSMITHS:config.blacksmiths,CLASS_BASE:config.heroes.classes,RARITY_WEIGHTS:config.heroes.rarityWeights,RARITY_MULT:config.heroes.rarityMultipliers};
}
export async function runtimeRules(){return gameRules(await getConfig());}
export async function saveSection(adminId:string,section:ConfigSection,value:unknown,expectedRevision:number){
 const id=settingsId();await getSettings();
 const result=await prisma.$transaction(async tx=>{
  await tx.$queryRaw`SELECT "id" FROM "RuntimeSettings" WHERE "id"=${id} FOR UPDATE`;
  const row=await tx.runtimeSettings.findUniqueOrThrow({where:{id}});
  if(row.revision!==expectedRevision)throw Object.assign(new Error("Settings have changed. Reload before saving."),{statusCode:409});
  const before=parseConfig(row.data);const config=parseConfig({...before,[section]:value});
  const next=await tx.runtimeSettings.update({where:{id},data:{data:config as unknown as Prisma.InputJsonValue,revision:{increment:1}}});
  await tx.adminChange.create({data:{adminId,section,before:before[section] as unknown as Prisma.InputJsonValue,after:config[section] as unknown as Prisma.InputJsonValue,revision:next.revision}});
  return {config,revision:next.revision};
 });
 cached={id,data:result.config,revision:result.revision,until:Date.now()+1000};return result;
}
