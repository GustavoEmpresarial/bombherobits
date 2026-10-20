import type { Prisma, SummonBatch, SummonSource } from "@prisma/client";
import { HERO_RARITIES, type SummonBatchDto, type SummonCardDto } from "@herobits/shared";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { toGold, toHeroDto, toUserDto } from "../lib/mappers.js";
import { getConfig } from "./config.js";
import { rollHero } from "./summon.js";
import { processTicks } from "./dungeon.js";

const rollSchema=z.object({
 class:z.enum(["WARRIOR","MAGE","ROGUE"]),rarity:z.enum(HERO_RARITIES),
 atk:z.number().int().positive(),spd:z.number().int().positive(),maxStamina:z.number().int().positive(),
});
const fail=(message:string,statusCode=400)=>Object.assign(new Error(message),{statusCode});
function cards(batch:SummonBatch):SummonCardDto[]{
 const rows=z.array(rollSchema).length(batch.count).parse(batch.rolls);
 return rows.map((row,slot)=>({...row,slot}));
}
function batchDto(batch:SummonBatch):SummonBatchDto{
 return {id:batch.id,requestId:batch.requestKey,source:batch.source,status:batch.status,count:batch.count,createdAt:batch.createdAt.toISOString(),
 ...(batch.status==="SEALED"?{}:{cards:cards(batch)})};
}
async function lockUser(tx:Prisma.TransactionClient,userId:string){
 await tx.$queryRawUnsafe('SELECT "id" FROM "User" WHERE "id"=$1 FOR UPDATE',userId);
 return tx.user.findUniqueOrThrow({where:{id:userId}});
}
async function ownedBatch(tx:Prisma.TransactionClient,userId:string,batchId:string){
 const batch=await tx.summonBatch.findFirst({where:{id:batchId,userId}});
 if(!batch)throw fail("Summon pack not found",404);
 return batch;
}
export async function pendingSummons(userId:string){
 const rows=await prisma.summonBatch.findMany({where:{userId,status:{in:["SEALED","REVEALED"]}},orderBy:{createdAt:"asc"}});
 return rows.map(batchDto);
}
export async function purchaseSummon(userId:string,count:number,source:SummonSource,requestKey:string){
 const config=await getConfig();
 await processTicks(userId);
 return prisma.$transaction(async tx=>{
  const user=await lockUser(tx,userId);
  const previous=await tx.summonBatch.findUnique({where:{userId_requestKey:{userId,requestKey}}});
  if(previous){
   if(previous.count!==count||previous.source!==source)throw fail("This request was already used for another pack",409);
   return {batch:batchDto(previous),user:toUserDto(user)};
  }
  const packs=source==="GOLD"?config.heroes.summonPacks:config.economy.MINT_PACKS;
  if(!Number.isInteger(count)||count<1||count>50||!packs.includes(count))throw fail("Invalid summon pack");
  const [owned,pending]=await Promise.all([
   tx.hero.count({where:{userId}}),
   tx.summonBatch.aggregate({where:{userId,status:{in:["SEALED","REVEALED"]}},_sum:{count:true}}),
  ]);
  if(owned+(pending._sum.count??0)+count>config.economy.MAX_ACTIVE)throw fail("Hero roster limit reached, including pending packs");
  const cost=source==="GOLD"?Math.round(config.heroes.summonCost*count*100)/100:0;
  if(source==="GOLD"&&toGold(user.gold)<cost)throw fail("Not enough gold");
  if(source==="CARDS"&&user.mintCards<count)throw fail("Not enough mint cards");
  const rolls=Array.from({length:count},()=>{
   const {class:heroClass,rarity,atk,spd,maxStamina}=rollHero(config);
   return {class:heroClass,rarity,atk,spd,maxStamina};
  });
  const updated=await tx.user.update({where:{id:userId},data:source==="GOLD"?{gold:{decrement:cost}}:{mintCards:{decrement:count}}});
  const batch=await tx.summonBatch.create({data:{userId,source,count,cost,requestKey,rolls:rolls as unknown as Prisma.InputJsonValue}});
  if(source==="GOLD")await tx.rewardLog.create({data:{userId,amount:-cost,source:"summon-pack:"+batch.id}});
  return {batch:batchDto(batch),user:toUserDto(updated)};
 },{timeout:15000});
}
export async function revealSummon(userId:string,batchId:string){
 return prisma.$transaction(async tx=>{
  await lockUser(tx,userId);
  let batch=await ownedBatch(tx,userId,batchId);
  if(batch.status==="SEALED")batch=await tx.summonBatch.update({where:{id:batch.id},data:{status:"REVEALED",revealedAt:new Date()}});
  return batchDto(batch);
 },{timeout:15000});
}
export async function claimSummon(userId:string,batchId:string){
 return prisma.$transaction(async tx=>{
  await lockUser(tx,userId);
  const batch=await ownedBatch(tx,userId,batchId);
  if(batch.status==="SEALED")throw fail("Reveal every card before sending heroes to your account",409);
  if(batch.status==="REVEALED"){
   const rows=cards(batch);
   await tx.hero.createMany({data:rows.map(row=>({
    userId,summonBatchId:batch.id,summonSlot:row.slot,class:row.class,rarity:row.rarity,atk:row.atk,spd:row.spd,
    maxStamina:row.maxStamina,stamina:row.maxStamina,status:"IDLE" as const,
   }))});
   await tx.summonBatch.update({where:{id:batch.id},data:{status:"CLAIMED",claimedAt:new Date()}});
  }
  const heroes=await tx.hero.findMany({where:{summonBatchId:batch.id,userId},orderBy:{summonSlot:"asc"}});
  const user=await tx.user.findUniqueOrThrow({where:{id:userId}});
  return {batchId:batch.id,heroes:heroes.map(toHeroDto),user:toUserDto(user)};
 },{timeout:15000});
}
