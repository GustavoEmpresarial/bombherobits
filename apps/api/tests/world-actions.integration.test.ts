import 'dotenv/config';
import { after, test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { prisma } from '../src/lib/prisma.js';
import { buyBlacksmith, buyPorter, withdrawChest, redeemInvite } from '../src/services/world.js';
import { getConfig, runtimeRules } from '../src/services/config.js';
const options = { skip: process.env.HEROBITS_TEST_DATABASE !== '1' };
after(async () => prisma.$disconnect());
async function player(check: (id: string) => Promise<void>) {
  const row = await prisma.user.create({data:{displayName:'Disposable QA player',wallet:'world-qa-'+randomUUID(),gold:50000,chest:1000,inviteCode:randomUUID()}});
  try { await check(row.id); } finally { await prisma.user.delete({where:{id:row.id}}); }
}
test('concurrent reward transfers credit the chest once',options,async()=>player(async id=>{
  const before=await prisma.user.findUniqueOrThrow({where:{id}});
  const results=await Promise.allSettled([withdrawChest(id),withdrawChest(id)]);
  assert.equal(results.filter(r=>r.status==='fulfilled').length,1);
  const after=await prisma.user.findUniqueOrThrow({where:{id}});
  const success=results.find(r=>r.status==='fulfilled') as PromiseFulfilledResult<Awaited<ReturnType<typeof withdrawChest>>>;
  assert.equal(Number(after.gold),Number(before.gold)+success.value.net);assert.equal(Number(after.chest),0);
}));
test('concurrent blacksmith purchases create and charge one smith',options,async()=>player(async id=>{
  const { BLACKSMITHS } = await runtimeRules();
  const results=await Promise.allSettled([buyBlacksmith(id,1),buyBlacksmith(id,1)]);
  assert.equal(results.filter(r=>r.status==='fulfilled').length,1);
  assert.equal(await prisma.blacksmith.count({where:{userId:id}}),1);
  assert.equal(Number((await prisma.user.findUniqueOrThrow({where:{id}})).gold),50000-BLACKSMITHS[0].price);
}));
test('concurrent porter purchases create only one companion',options,async()=>player(async id=>{
  await buyBlacksmith(id,1);
  const before=await prisma.user.findUniqueOrThrow({where:{id}});
  const { ECONOMY } = await runtimeRules();
  const results=await Promise.allSettled([buyPorter(id),buyPorter(id)]);
  assert.equal(results.filter(r=>r.status==='fulfilled').length,1);
  assert.equal(await prisma.porter.count({where:{userId:id}}),1);
  assert.equal(Number((await prisma.user.findUniqueOrThrow({where:{id}})).gold),Number(before.gold)-ECONOMY.PORTER_PRICE);
}));
test('concurrent invite redemption grants referral rewards once',options,async()=>player(async hostId=>player(async guestId=>{
  const host=await prisma.user.findUniqueOrThrow({where:{id:hostId}});
  const results=await Promise.allSettled([redeemInvite(guestId,host.inviteCode!),redeemInvite(guestId,host.inviteCode!)]);
  assert.equal(results.filter(r=>r.status==='fulfilled').length,1);
  const { referrals } = await getConfig();
  assert.equal((await prisma.user.findUniqueOrThrow({where:{id:hostId}})).mintCards,referrals.hostCards);
  assert.equal((await prisma.user.findUniqueOrThrow({where:{id:guestId}})).mintCards,referrals.guestCards);
})));

test('unaffordable services and unmet prerequisites do not spend gold',options,async()=>player(async id=>{
  await assert.rejects(()=>buyPorter(id),/blacksmith in service/);
  await assert.rejects(()=>buyBlacksmith(id,2),/previous tier/);
  await prisma.user.update({where:{id},data:{gold:0}});
  await assert.rejects(()=>buyBlacksmith(id,1),/Not enough gold/);
  assert.equal(await prisma.blacksmith.count({where:{userId:id}}),0);
  assert.equal(Number((await prisma.user.findUniqueOrThrow({where:{id}})).gold),0);
}));
