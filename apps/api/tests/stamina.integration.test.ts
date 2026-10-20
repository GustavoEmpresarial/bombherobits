import "dotenv/config";
import { after, test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { Keypair } from "@solana/web3.js";
import nacl from "tweetnacl";
import bs58 from "bs58";
import { prisma } from "../src/lib/prisma.js";
import { recoverStamina } from "../src/services/stamina.js";
import { deployHero, processTicks } from "../src/services/dungeon.js";

const enabled = process.env.HEROBITS_TEST_DATABASE === "1";
const options = { skip: !enabled };
after(async () => { await prisma.$disconnect(); });
async function withPlayer(check: (id: string) => Promise<void>) {
  const user = await prisma.user.create({ data: { wallet: "stamina-test-" + randomUUID(), displayName: "Temporary stamina test" } });
  try { await check(user.id); }
  finally { await prisma.user.delete({ where: { id: user.id } }); }
}
const heroData = (userId: string, createdAt: Date) => ({ userId, class: "WARRIOR" as const, rarity: "COMMON" as const, atk: 8, spd: 1, stamina: 0, maxStamina: 120, createdAt });

test("database clock prevents concurrent callers from double-crediting time", options, async () => {
  await withPlayer(async (id) => {
    const now = new Date(); const old = new Date(now.getTime() - 120_000);
    await prisma.user.update({ where: { id }, data: { staminaUpdatedAt: old } });
    const hero = await prisma.hero.create({ data: heroData(id, old) });
    await Promise.all(Array.from({ length: 4 }, () => recoverStamina(id, now)));
    const row = await prisma.hero.findUniqueOrThrow({ where: { id: hero.id } });
    assert.equal(row.stamina, 1);
    assert.equal(row.staminaRecoveryUnits, 0);
  });
});
test("listed and hunting heroes do not recover", options, async () => {
  await withPlayer(async (id) => {
    const now = new Date(); const old = new Date(now.getTime() - 600_000);
    await prisma.user.update({ where: { id }, data: { staminaUpdatedAt: old } });
    const listed = await prisma.hero.create({ data: { ...heroData(id, old), status: "LISTED" } });
    const hunter = await prisma.hero.create({ data: { ...heroData(id, old), status: "HUNTING", stamina: 5 } });
    await recoverStamina(id, now);
    assert.equal((await prisma.hero.findUniqueOrThrow({ where: { id: listed.id } })).stamina, 0);
    assert.equal((await prisma.hero.findUniqueOrThrow({ where: { id: hunter.id } })).stamina, 5);
  });
});
test("offline hunter starts recovering after its exhaustion tick", options, async (context) => {
  const now = Date.now(); context.mock.method(Date, "now", () => now);
  await withPlayer(async (id) => {
    const old = new Date(now - 135_000);
    await prisma.user.update({ where: { id }, data: { staminaUpdatedAt: old } });
    const hero = await prisma.hero.create({ data: { ...heroData(id, old), stamina: 1, status: "HUNTING", dungeonX: 1, dungeonY: 1 } });
    const run = await prisma.dungeonRun.create({ data: { userId: id, lastTickAt: old } });
    await prisma.dungeonTarget.create({ data: { runId: run.id, type: "SLIME", hp: 40, maxHp: 40, x: 3, y: 1 } });
    const snapshot = await processTicks(id);
    const row = snapshot!.heroes.find((item) => item.id === hero.id)!;
    assert.equal(row.status, "IDLE");
    assert.equal(row.stamina, 1);
    assert.equal(snapshot!.working, 0);
    assert.equal(row.dungeonX, null);
  });
});
test("forge slots are enforced in the database and waiters keep base recovery", options, async () => {
  await withPlayer(async (id) => {
    const now = new Date(); const old = new Date(now.getTime() - 120_000);
    await prisma.user.update({ where: { id }, data: { staminaUpdatedAt: old } });
    await prisma.blacksmith.create({ data: { userId: id, tier: 1, inService: true } });
    await prisma.hero.createMany({ data: Array.from({ length: 5 }, () => heroData(id, old)) });
    await recoverStamina(id, now);
    const rows = await prisma.hero.findMany({ where: { userId: id }, orderBy: [{ createdAt: "asc" }, { id: "asc" }] });
    assert.deepEqual(rows.map((hero) => hero.stamina), [4, 4, 4, 4, 1]);
  });
});
test("REST does not instantly refill; HTTP roster and WebSocket show passive recovery", options, async () => {
  const keys = Keypair.generate(); const wallet = keys.publicKey.toBase58();
  const base = process.env.HEROBITS_TEST_API_URL ?? "http://127.0.0.1:3001";
  let userId: string | undefined;
  async function request(path: string, token?: string, body?: unknown) {
    const response = await fetch(base + path, { method: body === undefined ? "GET" : "POST", headers: { "Content-Type": "application/json", ...(token ? { Authorization: "Bearer " + token } : {}) }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
    const data = await response.json() as any;
    assert.equal(response.ok, true, path + ": " + JSON.stringify(data));
    return data;
  }
  try {
    const challenge = await request("/auth/nonce", undefined, { wallet });
    const signature = bs58.encode(nacl.sign.detached(new TextEncoder().encode(challenge.message), keys.secretKey));
    const login = await request("/auth/wallet", undefined, { wallet, signature, nonce: challenge.nonce });
    userId = login.user.id;
    const hero = await prisma.hero.findFirstOrThrow({ where: { userId } });
    await prisma.hero.update({ where: { id: hero.id }, data: { stamina: 0 } });
    const rested = await request("/heroes/" + hero.id + "/rest", login.token, {});
    assert.equal(rested.stamina, 0);
    const old = new Date(Date.now() - 120_000);
    await prisma.hero.update({ where: { id: hero.id }, data: { createdAt: old } });
    await prisma.user.update({ where: { id: userId }, data: { staminaUpdatedAt: old } });
    const roster = await request("/heroes", login.token);
    assert.equal(roster.find((row: any) => row.id === hero.id).stamina, 1);
    await request("/dungeon/start", login.token, {});
    const beforeSocket = new Date(Date.now() - 120_000);
    await prisma.user.update({ where: { id: userId }, data: { staminaUpdatedAt: beforeSocket } });
    await new Promise<void>((resolve, reject) => {
      const socket = new WebSocket(base.replace(/^http/, "ws") + "/dungeon/ws?token=" + encodeURIComponent(login.token));
      const timer = setTimeout(() => { socket.close(); reject(new Error("No stamina snapshot received")); }, 8000);
      socket.onmessage = (event) => {
        const message = JSON.parse(String(event.data));
        if (message.type !== "snapshot") return;
        clearTimeout(timer); socket.close();
        try { assert.equal(message.data.heroes.find((row: any) => row.id === hero.id).stamina, 2); resolve(); }
        catch (error) { reject(error); }
      };
      socket.onerror = () => { clearTimeout(timer); socket.close(); reject(new Error("WebSocket failed")); };
    });
  } finally {
    if (userId) await prisma.user.delete({ where: { id: userId } });
    await prisma.authChallenge.deleteMany({ where: { wallet } });
  }
});

test("work drains four points per minute while attacks keep their normal cadence", options, async context => {
  const now=Date.now(); context.mock.method(Date,"now",()=>now);
  await withPlayer(async id=>{
    const old=new Date(now-60000);
    await prisma.user.update({where:{id},data:{staminaUpdatedAt:old}});
    const hero=await prisma.hero.create({data:{...heroData(id,old),atk:1,stamina:10,status:"HUNTING",dungeonX:2,dungeonY:1}});
    const run=await prisma.dungeonRun.create({data:{userId:id,lastTickAt:old}});
    await prisma.dungeonTarget.create({data:{runId:run.id,type:"SLIME",hp:1000,maxHp:1000,x:3,y:1}});
    const snapshot=(await processTicks(id))!;
    assert.equal(snapshot.heroes.find(row=>row.id===hero.id)!.stamina,6);
    assert.equal(snapshot.combatSequence,60);
    assert.equal((await prisma.hero.findUniqueOrThrow({where:{id:hero.id}})).staminaUsageUnits,0);
  });
});
test("resting and reactivating retain accumulated work time instead of resetting consumption", options, async context => {
  let now=Date.now(); context.mock.method(Date,"now",()=>now);
  await withPlayer(async id=>{
    const old=new Date(now-14000);
    await prisma.user.update({where:{id},data:{staminaUpdatedAt:old}});
    const hero=await prisma.hero.create({data:{...heroData(id,old),atk:1,stamina:10,status:"HUNTING",dungeonX:2,dungeonY:1}});
    const run=await prisma.dungeonRun.create({data:{userId:id,lastTickAt:old}});
    await prisma.dungeonTarget.create({data:{runId:run.id,type:"SLIME",hp:1000,maxHp:1000,x:3,y:1}});
    await processTicks(id);
    let row=await prisma.hero.findUniqueOrThrow({where:{id:hero.id}});
    assert.equal(row.stamina,10);assert.equal(row.staminaUsageUnits,56000);
    await prisma.hero.update({where:{id:hero.id},data:{status:"IDLE",dungeonX:null,dungeonY:null}});
    now+=600000;await processTicks(id);
    row=await prisma.hero.findUniqueOrThrow({where:{id:hero.id}});
    assert.equal(row.stamina,15);assert.equal(row.staminaUsageUnits,56000);
    await deployHero(id,hero.id);now+=1000;await processTicks(id);
    row=await prisma.hero.findUniqueOrThrow({where:{id:hero.id}});
    assert.equal(row.stamina,14);assert.equal(row.staminaUsageUnits,0);
  });
});
