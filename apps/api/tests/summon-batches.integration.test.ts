import "dotenv/config";
import {after,test} from "node:test";
import assert from "node:assert/strict";
import {randomUUID} from "node:crypto";
import Fastify from "fastify";
import jwt from "@fastify/jwt";
import {DEFAULT_CONFIG,type RuntimeConfig} from "@herobits/shared";
import {prisma} from "../src/lib/prisma.js";
import {pendingSummons,purchaseSummon,revealSummon,claimSummon} from "../src/services/summon-batches.js";
import {summonRoutes} from "../src/routes/summons.js";
const options={skip:process.env.HEROBITS_TEST_DATABASE!=="1"};
after(async()=>{await prisma.$disconnect();});
async function player(check:(id:string)=>Promise<void>,configure?:(config:RuntimeConfig)=>void){
 const previous=process.env.HEROBITS_CONFIG_ID,id="summon-test-"+randomUUID();
 process.env.HEROBITS_CONFIG_ID=id;
 const config=structuredClone(DEFAULT_CONFIG);configure?.(config);
 await prisma.runtimeSettings.create({data:{id,data:config}});
 const user=await prisma.user.create({data:{wallet:"summon-test-"+randomUUID(),displayName:"Temporary summon test",gold:10000,mintCards:20}});
 try{await check(user.id);}
 finally{await prisma.user.delete({where:{id:user.id}});await prisma.runtimeSettings.delete({where:{id}});if(previous===undefined)delete process.env.HEROBITS_CONFIG_ID;else process.env.HEROBITS_CONFIG_ID=previous;}
}
test("buying a pack charges once and keeps its heroes sealed outside the roster",options,async()=>player(async id=>{
 const result=await purchaseSummon(id,5,"GOLD",randomUUID());
 assert.equal(result.user.gold,9500);assert.equal(result.batch.count,5);assert.equal(result.batch.status,"SEALED");
 assert.equal(result.batch.cards,undefined);assert.equal(await prisma.hero.count({where:{userId:id}}),0);
 const pending=await pendingSummons(id);assert.equal(pending.length,1);assert.equal(pending[0].cards,undefined);
 assert.equal(await prisma.rewardLog.count({where:{userId:id}}),1);
}));
test("revealing is persistent, repeatable and does not deliver any heroes",options,async()=>player(async id=>{
 const bought=await purchaseSummon(id,5,"GOLD",randomUUID());
 const revealed=await revealSummon(id,bought.batch.id);const again=await revealSummon(id,bought.batch.id);
 assert.equal(revealed.status,"REVEALED");assert.equal(revealed.cards!.length,5);
 assert.deepEqual(again.cards,revealed.cards);assert.deepEqual((await pendingSummons(id))[0].cards,revealed.cards);
 assert.equal(await prisma.hero.count({where:{userId:id}}),0);
}));
test("claim requires revelation; explicit delivery grants each card once even with concurrent retries",options,async()=>player(async id=>{
 const bought=await purchaseSummon(id,5,"GOLD",randomUUID());
 await assert.rejects(()=>claimSummon(id,bought.batch.id),{statusCode:409});
 const revealed=await revealSummon(id,bought.batch.id);
 const [first,second]=await Promise.all([claimSummon(id,bought.batch.id),claimSummon(id,bought.batch.id)]);
 assert.equal(first.heroes.length,5);assert.deepEqual(first.heroes.map(h=>h.id),second.heroes.map(h=>h.id));
 assert.equal(await prisma.hero.count({where:{userId:id}}),5);assert.equal((await pendingSummons(id)).length,0);
 first.heroes.forEach((hero,index)=>{assert.equal(hero.rarity,revealed.cards![index].rarity);assert.equal(hero.atk,revealed.cards![index].atk);assert.equal(hero.stamina,hero.maxStamina);assert.equal(hero.status,"IDLE");});
 assert.equal(first.user.gold,9500);
}));
test("concurrent repeats of one purchase key cannot double-charge or create another pack",options,async()=>player(async id=>{
 const request=randomUUID();const results=await Promise.all([purchaseSummon(id,5,"GOLD",request),purchaseSummon(id,5,"GOLD",request)]);
 assert.equal(results[0].batch.id,results[1].batch.id);
 assert.equal(Number((await prisma.user.findUniqueOrThrow({where:{id}})).gold),9500);
 assert.equal(await prisma.summonBatch.count({where:{userId:id}}),1);
 await assert.rejects(()=>purchaseSummon(id,1,"GOLD",request),{statusCode:409});
}));
test("concurrent different purchases cannot overspend the balance",options,async()=>player(async id=>{
 await prisma.user.update({where:{id},data:{gold:100}});
 const results=await Promise.allSettled([purchaseSummon(id,1,"GOLD",randomUUID()),purchaseSummon(id,1,"GOLD",randomUUID())]);
 assert.equal(results.filter(r=>r.status==="fulfilled").length,1);
 assert.equal(Number((await prisma.user.findUniqueOrThrow({where:{id}})).gold),0);
 assert.equal(await prisma.summonBatch.count({where:{userId:id}}),1);
}));
test("rescue cards also create pending packs and are consumed only once",options,async()=>player(async id=>{
 const request=randomUUID(),result=await purchaseSummon(id,5,"CARDS",request);
 await purchaseSummon(id,5,"CARDS",request);
 assert.equal(result.user.mintCards,15);assert.equal(result.user.gold,10000);
 assert.equal(result.batch.source,"CARDS");assert.equal(await prisma.hero.count({where:{userId:id}}),0);
 await revealSummon(id,result.batch.id);await claimSummon(id,result.batch.id);
 assert.equal(await prisma.hero.count({where:{userId:id}}),5);
 assert.equal((await prisma.user.findUniqueOrThrow({where:{id}})).mintCards,15);
}));
test("pending packs reserve roster capacity before their heroes are delivered",options,async()=>player(async id=>{
 await purchaseSummon(id,5,"GOLD",randomUUID());
 await assert.rejects(()=>purchaseSummon(id,1,"GOLD",randomUUID()),{statusCode:400});
 assert.equal(Number((await prisma.user.findUniqueOrThrow({where:{id}})).gold),9500);
},config=>{config.economy.MAX_ACTIVE=5;config.game.MAX_WORKING_HEROES=5;}));
test("another player cannot reveal, claim or list someone else's pack",options,async()=>player(async id=>{
 const result=await purchaseSummon(id,1,"GOLD",randomUUID());
 const other=await prisma.user.create({data:{wallet:"summon-other-"+randomUUID(),displayName:"Temporary other"}});
 try{
  await assert.rejects(()=>revealSummon(other.id,result.batch.id),{statusCode:404});
  await assert.rejects(()=>claimSummon(other.id,result.batch.id),{statusCode:404});
  assert.deepEqual(await pendingSummons(other.id),[]);
 }finally{await prisma.user.delete({where:{id:other.id}});}
}));
test("invalid packs and insufficient rescue cards leave all balances unchanged",options,async()=>player(async id=>{
 await assert.rejects(()=>purchaseSummon(id,2,"GOLD",randomUUID()),{statusCode:400});
 await prisma.user.update({where:{id},data:{mintCards:0}});
 await assert.rejects(()=>purchaseSummon(id,1,"CARDS",randomUUID()),{statusCode:400});
 assert.equal(await prisma.summonBatch.count({where:{userId:id}}),0);
 assert.equal(Number((await prisma.user.findUniqueOrThrow({where:{id}})).gold),10000);
}));
test("HTTP routes require login, reject forged heroes and deliver only after reveal plus claim",options,async()=>player(async id=>{
 const app=Fastify();await app.register(jwt,{secret:"temporary-summon-test-secret"});await app.register(summonRoutes);await app.ready();
 const headers={authorization:"Bearer "+app.jwt.sign({id})};
 try{
  assert.equal((await app.inject("/heroes/summons/pending")).statusCode,401);
  assert.equal((await app.inject({method:"POST",url:"/heroes/summon",headers,payload:{count:1,requestId:randomUUID(),rarity:"SUPER_LEGENDARY"}})).statusCode,400);
  const bought=await app.inject({method:"POST",url:"/heroes/summon",headers,payload:{count:1,requestId:randomUUID()}});assert.equal(bought.statusCode,200);
  const batch=bought.json().batch;assert.equal(batch.cards,undefined);
  assert.equal((await app.inject({method:"POST",url:"/heroes/summons/"+batch.id+"/claim",headers,payload:{}})).statusCode,409);
  assert.equal((await app.inject({method:"POST",url:"/heroes/summons/"+batch.id+"/reveal",headers,payload:{}})).statusCode,200);
  const claimed=await app.inject({method:"POST",url:"/heroes/summons/"+batch.id+"/claim",headers,payload:{}});assert.equal(claimed.statusCode,200);assert.equal(claimed.json().heroes.length,1);
 }finally{await app.close();}
}));

test("configured stamina is stored at purchase and preserved through later admin edits",options,async()=>player(async id=>{
 const bought=await purchaseSummon(id,5,"GOLD",randomUUID());
 const stored=await prisma.summonBatch.findUniqueOrThrow({where:{id:bought.batch.id}});
 const rows=stored.rolls as {maxStamina:number}[];
 assert(rows.every(row=>row.maxStamina===175));
 const settings=await prisma.runtimeSettings.findUniqueOrThrow({where:{id:process.env.HEROBITS_CONFIG_ID!}});
 const changed=structuredClone(settings.data) as unknown as RuntimeConfig;
 changed.stamina.energyPerPoint=10;
 await prisma.runtimeSettings.update({where:{id:settings.id},data:{data:changed as any}});
 const revealed=await revealSummon(id,bought.batch.id);
 assert(revealed.cards!.every(card=>card.maxStamina===175));
 const claimed=await claimSummon(id,bought.batch.id);
 assert(claimed.heroes.every(hero=>hero.maxStamina===175&&hero.stamina===175));
},config=>{config.stamina.energyPerPoint=25;for(const range of Object.values(config.stamina.rarityPoints)){range.min=7;range.max=7;}}));
