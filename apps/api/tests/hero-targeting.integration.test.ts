import 'dotenv/config';
import {after,test} from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {prisma} from '../src/lib/prisma.js';
import {processTicks} from '../src/services/dungeon.js';
const options={skip:process.env.HEROBITS_TEST_DATABASE!=='1'};
after(async()=>{await prisma.$disconnect();});

test('a blocked hunter moves to another chest and attacks while teammates keep attacking',options,async context=>{
 const now=Date.now();context.mock.method(Date,'now',()=>now);
 const old=new Date(now-1000);
 const user=await prisma.user.create({data:{wallet:'targeting-test-'+randomUUID(),displayName:'Temporary targeting test',staminaUpdatedAt:old}});
 try {
  const run=await prisma.dungeonRun.create({data:{userId:user.id,lastTickAt:old,waveTotal:2}});
  const near=await prisma.dungeonTarget.create({data:{runId:run.id,type:'BLOCK',kind:'ancient-vault',hp:1000,maxHp:1000,reward:500,x:3,y:1}});
  const far=await prisma.dungeonTarget.create({data:{runId:run.id,type:'SLIME',kind:'wooden-crate',hp:80,maxHp:80,reward:50,x:1,y:5}});
  const base={userId:user.id,rarity:'COMMON' as const,atk:8,spd:1,stamina:100,maxStamina:120,status:'HUNTING' as const,createdAt:old};
  const hunter=await prisma.hero.create({data:{...base,class:'MAGE',dungeonX:1,dungeonY:1}});
  for(const [x,y] of [[2,1],[3,2],[4,1]])await prisma.hero.create({data:{...base,class:'WARRIOR',dungeonX:x,dungeonY:y}});
  const snapshot=(await processTicks(user.id))!;
  const hero=snapshot.heroes.find(h=>h.id===hunter.id)!;
  assert.deepEqual({x:hero.dungeonX,y:hero.dungeonY},{x:1,y:2});
  assert(snapshot.combatEvents.some(hit=>hit.heroId===hunter.id&&hit.targetId===far.id));
  assert.equal(snapshot.combatEvents.filter(hit=>hit.targetId===near.id).length,3);
  assert.equal(snapshot.targets.find(t=>t.id===far.id)!.hp,72);
  const positions=snapshot.heroes.map(h=>h.dungeonX+','+h.dungeonY);
  assert.equal(new Set(positions).size,4);
  assert(snapshot.targets.every(t=>!positions.includes(t.x+','+t.y)));
 } finally {await prisma.user.delete({where:{id:user.id}});}
});

test('a hunter resumes searching after another hero destroys its nearby chest',options,async context=>{
 const now=Date.now();context.mock.method(Date,'now',()=>now);
 const old=new Date(now-3000);
 const user=await prisma.user.create({data:{wallet:'retarget-test-'+randomUUID(),displayName:'Temporary retarget test',staminaUpdatedAt:old}});
 try {
  const run=await prisma.dungeonRun.create({data:{userId:user.id,lastTickAt:old,waveTotal:2}});
  const base={userId:user.id,class:'WARRIOR' as const,rarity:'COMMON' as const,spd:1,stamina:100,maxStamina:120,status:'HUNTING' as const,createdAt:old};
  await prisma.hero.create({data:{...base,atk:100,dungeonX:2,dungeonY:1}});
  const hunter=await prisma.hero.create({data:{...base,atk:8,dungeonX:1,dungeonY:1}});
  await prisma.dungeonTarget.create({data:{runId:run.id,type:'SLIME',hp:40,maxHp:40,reward:50,x:3,y:1}});
  const far=await prisma.dungeonTarget.create({data:{runId:run.id,type:'BLOCK',hp:1000,maxHp:1000,reward:500,x:1,y:5}});
  const snapshot=(await processTicks(user.id))!;
  assert.equal(snapshot.openedCrates,1);
  assert(snapshot.combatEvents.some(hit=>hit.heroId===hunter.id&&hit.targetId===far.id));
 } finally {await prisma.user.delete({where:{id:user.id}});}
});
