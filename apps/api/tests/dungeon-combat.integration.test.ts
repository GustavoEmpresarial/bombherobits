import "dotenv/config";
import { after, test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { prisma } from "../src/lib/prisma.js";
import { buildSnapshot, processTicks, startDungeon, spawnTargets } from "../src/services/dungeon.js";
const options = {skip:process.env.HEROBITS_TEST_DATABASE !== "1"};
after(async()=>{await prisma.$disconnect();});
async function fixture(now:number, targets:number, attack:number, check:(userId:string,runId:string)=>Promise<void>, elapsed=1000){
 const old=new Date(now-elapsed);const user=await prisma.user.create({data:{wallet:"combat-test-"+randomUUID(),displayName:"Temporary combat test",staminaUpdatedAt:old}});
 try {
  const run=await prisma.dungeonRun.create({data:{userId:user.id,lastTickAt:old,waveTotal:targets}});
  await prisma.hero.create({data:{userId:user.id,class:"WARRIOR",rarity:"COMMON",atk:attack,spd:1,stamina:100,maxStamina:120,status:"HUNTING",dungeonX:2,dungeonY:1,createdAt:old}});
  await prisma.dungeonTarget.createMany({data:Array.from({length:targets},(_,i)=>({runId:run.id,type:"SLIME" as const,kind:"wooden-crate",reward:2.5,hp:attack===1?1000:40,maxHp:attack===1?1000:40,x:3+i*2,y:1}))});
  await check(user.id,run.id);
 } finally {await prisma.user.delete({where:{id:user.id}});}
}
test("destroying a crate decreases remaining count, persists progress and emits a final hit",options,async context=>{
 const now=Date.now();context.mock.method(Date,"now",()=>now);
 await fixture(now,2,100,async id=>{const snap=(await processTicks(id))!;assert.equal(snap.targets.length,1);assert.equal(snap.openedCrates,1);assert.equal(snap.wave,1);assert.equal(snap.chest,2.5);assert.equal(snap.combatSequence,1);assert.equal(snap.combatEvents[0].damage,40);assert.equal(snap.combatEvents[0].destroyed,true);assert.equal(snap.combatEvents[0].reward,2.5);const reread=(await buildSnapshot(id))!;assert.equal(reread.openedCrates,1);assert.equal(reread.targets.length,1);});
});
test("ordinary hits keep the crate and do not increment opened count",options,async context=>{
 const now=Date.now();context.mock.method(Date,"now",()=>now);
 await fixture(now,2,8,async id=>{const [a,b]=await Promise.all([processTicks(id),processTicks(id)]);assert.equal(a!.targets.length,2);assert.equal(a!.openedCrates,0);assert.equal(a!.combatSequence,1);assert.equal(b!.combatSequence,1);assert.equal(a!.combatEvents[0].destroyed,false);assert.equal(a!.targets.find(row=>row.id===a!.combatEvents[0].targetId)!.hp,32);assert.equal((await processTicks(id))!.combatSequence,1);});
});
test("the counter reaches zero before the next wave, without resetting the run",options,async context=>{
 let now=Date.now();context.mock.method(Date,"now",()=>now);
 await fixture(now,1,100,async(id,runId)=>{const empty=(await processTicks(id))!;assert.equal(empty.targets.length,0);assert.equal(empty.wave,1);assert.equal((await startDungeon(id))!.runId,runId);assert.equal((await buildSnapshot(id))!.targets.length,0);await prisma.hero.updateMany({where:{userId:id},data:{status:"IDLE",dungeonX:null,dungeonY:null}});now+=1000;const next=(await processTicks(id))!;assert.equal(next.wave,2);assert.equal(next.targets.length,60);assert.equal(next.waveTotal,60);assert.equal(next.openedCrates,1);assert.equal(next.runId,runId);});
});
test("long hunts retain only the latest 64 events with a monotonic sequence",options,async context=>{
 const now=Date.now();context.mock.method(Date,"now",()=>now);
 await fixture(now,1,1,async id=>{const snap=(await processTicks(id))!;assert.equal(snap.combatSequence,65);assert.equal(snap.combatEvents.length,64);assert.equal(snap.combatEvents[0].sequence,2);assert.equal(snap.combatEvents.at(-1)!.sequence,65);assert.equal(snap.targets[0].hp,935);},65000);
});

test('expanding an existing wave preserves damage and avoids chests and hunters',options,async context=>{
 const now=Date.now();context.mock.method(Date,'now',()=>now);
 await fixture(now,1,8,async(id,runId)=>{
  const original=await prisma.dungeonTarget.findFirstOrThrow({where:{runId}});
  await prisma.dungeonTarget.update({where:{id:original.id},data:{hp:17}});
  const added=await spawnTargets(runId,59);assert.equal(added,59);
  const snapshot=(await buildSnapshot(id))!;
  assert.equal(snapshot.targets.length,60);
  assert.equal(snapshot.targets.find(t=>t.id===original.id)!.hp,17);
  assert.equal(new Set(snapshot.targets.map(t=>t.x+','+t.y)).size,60);
  assert(snapshot.targets.every(t=>t.x!==2||t.y!==1));
  assert.equal(new Set(snapshot.targets.map(t=>t.kind)).size,5);
 });
});
