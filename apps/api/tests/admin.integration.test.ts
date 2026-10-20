import {readFile} from "node:fs/promises";
import "dotenv/config";
import { after,test } from "node:test";
import assert from "node:assert/strict";
import { randomBytes,randomUUID } from "node:crypto";
import Fastify,{type FastifyInstance} from "fastify";
import { DEFAULT_CONFIG } from "@herobits/shared";
import { prisma } from "../src/lib/prisma.js";
import { adminRoutes } from "../src/routes/admin.js";
import { hashPassword,tokenHash,verifyPassword } from "../src/lib/admin-crypto.js";
import { getSettings,saveSection,getConfig } from "../src/services/config.js";
import { spawnTargets,buildSnapshot,processTicks } from "../src/services/dungeon.js";
import { rollHero } from "../src/services/summon.js";
import { parseConfig } from "../src/services/config-validation.js";
const options={skip:process.env.HEROBITS_TEST_DATABASE!=="1"};
after(async()=>{await prisma.$disconnect();});
type Context={app:FastifyInstance;path:string;token:string;username:string;password:string;adminId:string;login:()=>Promise<string>};
async function withAdmin(check:(ctx:Context)=>Promise<void>){
 const configId="admin-test-"+randomUUID();const previous=process.env.HEROBITS_CONFIG_ID;process.env.HEROBITS_CONFIG_ID=configId;
 const token=randomBytes(32).toString('hex'),password=randomBytes(24).toString('hex'),username="qa-"+randomUUID(),path="/_ops-testingabcdefghijklmnop";
 const admin=await prisma.adminUser.create({data:{username,passwordHash:await hashPassword(password)}});const app=Fastify();
 try{await app.register(adminRoutes,{path,accessHash:tokenHash(token)});await app.ready();const login=async()=>{const response=await app.inject({method:'POST',url:path+'/api/login',headers:{'x-admin-access':token},payload:{username,password}});assert.equal(response.statusCode,200);return String(response.headers['set-cookie']).split(';')[0];};await check({app,path,token,username,password,adminId:admin.id,login});}
 finally{await app.close();await prisma.adminChange.deleteMany({where:{adminId:admin.id}});await prisma.adminUser.delete({where:{id:admin.id}});await prisma.runtimeSettings.deleteMany({where:{id:configId}});if(previous===undefined)delete process.env.HEROBITS_CONFIG_ID;else process.env.HEROBITS_CONFIG_ID=previous;}
}
test('admin passwords are salted hashes, never plaintext',async()=>{const hash=await hashPassword('a-long-private-password-for-testing');assert(!hash.includes('a-long-private-password-for-testing'));assert(await verifyPassword('a-long-private-password-for-testing',hash));assert.equal(await verifyPassword('wrong',hash),false);});
test('configuration defaults contain five independent crate rules',()=>{const config=parseConfig(DEFAULT_CONFIG);assert.deepEqual(Object.values(config.crates).map(c=>c.maxHp),[80,250,500,750,1000]);assert.deepEqual(Object.values(config.crates).map(c=>c.reward),[50,125,250,375,500]);});
test('invalid rates, unknown fields and incorrect rarity odds are rejected',()=>{assert.throws(()=>parseConfig({...DEFAULT_CONFIG,stamina:{recoveryPerMinute:0,usagePerMinute:4}}));assert.throws(()=>parseConfig({...DEFAULT_CONFIG,secret:'unexpected'}));const config=structuredClone(DEFAULT_CONFIG);config.heroes.rarityWeights.COMMON=99;assert.throws(()=>parseConfig(config));});
test('normal admin address and missing/wrong access tokens reveal no settings',options,async()=>withAdmin(async({app,path,token})=>{assert.equal((await app.inject('/admin')).statusCode,404);assert.equal((await app.inject(path+'/api/settings')).statusCode,404);assert.equal((await app.inject({url:path+'/api/settings',headers:{'x-admin-access':'wrong'}})).statusCode,404);assert.equal((await app.inject({url:path+'/api/settings',headers:{'x-admin-access':token,authorization:'Bearer player-token'}})).statusCode,401);}));
test('login requires both the access token and exclusive administrative password',options,async()=>withAdmin(async({app,path,token,username,password})=>{assert.equal((await app.inject({method:'POST',url:path+'/api/login',payload:{username,password}})).statusCode,404);assert.equal((await app.inject({method:'POST',url:path+'/api/login',headers:{'x-admin-access':token},payload:{username,password:'wrong'}})).statusCode,401);const response=await app.inject({method:'POST',url:path+'/api/login',headers:{'x-admin-access':token},payload:{username,password}});assert.equal(response.statusCode,200);assert(String(response.headers['set-cookie']).includes('HttpOnly'));assert(String(response.headers['set-cookie']).includes('SameSite=Strict'));assert(!response.body.includes(password));assert(!response.body.includes(token));}));
test('admin page uses restrictive CSP, no-store and no embedded credentials',options,async()=>withAdmin(async({app,path,password,token})=>{const response=await app.inject(path);assert.equal(response.statusCode,200);assert.equal(response.headers['cache-control'],'no-store');assert(String(response.headers['content-security-policy']).includes("frame-ancestors 'none'"));assert(!response.body.includes(password));assert(!response.body.includes(token));}));
test('cross-origin requests cannot use an admin session',options,async()=>withAdmin(async({app,path,token,login})=>{const cookie=await login();assert.equal((await app.inject({url:path+'/api/settings',headers:{'x-admin-access':token,cookie,origin:'https://foreign.invalid'}})).statusCode,404);assert.equal((await app.inject({url:path+'/api/settings',headers:{'x-admin-access':token,cookie}})).statusCode,200);}));
test('expired sessions and disabled admin accounts are refused',options,async()=>withAdmin(async({app,path,token,adminId,login})=>{const cookie=await login();await prisma.adminSession.updateMany({where:{adminId},data:{expiresAt:new Date(0)}});assert.equal((await app.inject({url:path+'/api/settings',headers:{'x-admin-access':token,cookie}})).statusCode,401);const fresh=await login();await prisma.adminUser.update({where:{id:adminId},data:{disabled:true}});assert.equal((await app.inject({url:path+'/api/settings',headers:{'x-admin-access':token,cookie:fresh}})).statusCode,401);}));
test('logout revokes the old session',options,async()=>withAdmin(async({app,path,token,login})=>{const cookie=await login();assert.equal((await app.inject({method:'POST',url:path+'/api/logout',headers:{'x-admin-access':token,cookie},payload:{}})).statusCode,200);assert.equal((await app.inject({url:path+'/api/settings',headers:{'x-admin-access':token,cookie}})).statusCode,401);}));
test('repeated failed logins are rate limited',options,async()=>withAdmin(async({app,path,token,username})=>{for(let i=0;i<5;i++)assert.equal((await app.inject({method:'POST',url:path+'/api/login',headers:{'x-admin-access':token},payload:{username,password:'wrong'}})).statusCode,401);assert.equal((await app.inject({method:'POST',url:path+'/api/login',headers:{'x-admin-access':token},payload:{username,password:'wrong'}})).statusCode,429);}));
test('saving a section validates values, records an audit and rejects stale revisions',options,async()=>withAdmin(async({app,path,token,adminId,login})=>{const cookie=await login();const headers={'x-admin-access':token,cookie};const before=await getSettings();const changed={...before.config.stamina,usagePerMinute:8};const saved=await app.inject({method:'PUT',url:path+'/api/settings/stamina',headers,payload:{revision:before.revision,value:changed}});assert.equal(saved.statusCode,200);assert.equal((await getConfig()).stamina.usagePerMinute,8);assert.equal((await prisma.adminChange.findMany({where:{adminId}})).length,1);assert.equal((await app.inject({method:'PUT',url:path+'/api/settings/stamina',headers,payload:{revision:before.revision,value:changed}})).statusCode,409);assert.equal((await app.inject({method:'PUT',url:path+'/api/settings/stamina',headers,payload:{revision:before.revision+1,value:{usagePerMinute:-1,recoveryPerMinute:0}}})).statusCode,400);assert.equal((await getConfig()).stamina.usagePerMinute,8);}));
test('edited crate values control actual spawns, visuals and rewards',options,async()=>withAdmin(async({adminId})=>{const settings=await getSettings();const crates=structuredClone(settings.config.crates);for(const entry of Object.values(crates))entry.weight=0;crates['wooden-crate']={name:'Madeira de teste',maxHp:90,reward:77,weight:100};await saveSection(adminId,'crates',crates,settings.revision);const user=await prisma.user.create({data:{wallet:'loot-test-'+randomUUID(),displayName:'Temporary loot test'}});try{const run=await prisma.dungeonRun.create({data:{userId:user.id}});await spawnTargets(run.id);const snapshot=(await buildSnapshot(user.id))!;assert.equal(snapshot.targets.length,60);assert(snapshot.targets.every(t=>t.kind==='wooden-crate'&&t.maxHp===90));const rows=await prisma.dungeonTarget.findMany({where:{runId:run.id}});assert(rows.every(t=>Number(t.reward)===77));}finally{await prisma.user.delete({where:{id:user.id}});}}));
test('hero attributes and rarity rules change actual summoned heroes',options,async()=>withAdmin(async({adminId})=>{const settings=await getSettings();const heroes=structuredClone(settings.config.heroes);heroes.rarityWeights={COMMON:100,RARE:0,SUPER_RARE:0,EPIC:0,LEGENDARY:0,SUPER_LEGENDARY:0};for(const row of Object.values(heroes.classes)){row.atk=37;row.spd=2;}await saveSection(adminId,'heroes',heroes,settings.revision);for(let i=0;i<10;i++){const hero=rollHero();assert.equal(hero.rarity,'COMMON');assert.equal(hero.atk,37);assert(hero.maxStamina>=50&&hero.maxStamina<=150);}}));

test('runtime stamina edits control passive recovery and working consumption',options,async context=>{
 const now=Date.now();context.mock.method(Date,'now',()=>now);
 await withAdmin(async({adminId})=>{
  const settings=await getSettings();await saveSection(adminId,'stamina',{...settings.config.stamina,recoveryPerMinute:2,usagePerMinute:8},settings.revision);
  const old=new Date(now-60000);const user=await prisma.user.create({data:{wallet:'rate-test-'+randomUUID(),displayName:'Temporary runtime test',staminaUpdatedAt:old}});
  try{
   const resting=await prisma.hero.create({data:{userId:user.id,class:'WARRIOR',rarity:'COMMON',atk:8,spd:1,maxStamina:120,stamina:10,createdAt:old}});
   const working=await prisma.hero.create({data:{userId:user.id,class:'WARRIOR',rarity:'COMMON',atk:8,spd:1,maxStamina:120,stamina:20,createdAt:old,status:'HUNTING',dungeonX:1,dungeonY:1}});
   const run=await prisma.dungeonRun.create({data:{userId:user.id,lastTickAt:old}});
   await prisma.dungeonTarget.create({data:{runId:run.id,type:'BLOCK',kind:'ancient-vault',hp:1000,maxHp:1000,reward:500,x:3,y:1}});
   const snapshot=(await processTicks(user.id))!;
   assert.equal(snapshot.heroes.find(hero=>hero.id===resting.id)!.stamina,12);
   assert.equal(snapshot.heroes.find(hero=>hero.id===working.id)!.stamina,12);
   assert.equal(snapshot.targets.length,1);
  }finally{await prisma.user.delete({where:{id:user.id}});}
 });
});

test('admin stamina ranges and conversion control new heroes, without rewriting purchased packs',options,async()=>withAdmin(async({adminId})=>{
 let settings=await getSettings();
 const stamina=structuredClone(settings.config.stamina);
 stamina.energyPerPoint=40;stamina.rarityPoints.COMMON={min:5,max:5};
 await saveSection(adminId,'stamina',stamina,settings.revision);
 for(let i=0;i<20;i++){const hero=rollHero();const range=stamina.rarityPoints[hero.rarity];assert(hero.maxStamina>=range.min*40&&hero.maxStamina<=range.max*40);assert.equal(hero.maxStamina%40,0);}
 settings=await getSettings();assert.deepEqual(settings.config.stamina,stamina);
}));

test('stamina migration upgrades legacy configuration and preserves charge percentage for all six rarities',options,async()=>withAdmin(async()=>{
 const id=process.env.HEROBITS_CONFIG_ID!;const legacy=structuredClone(DEFAULT_CONFIG) as any;
 delete legacy.stamina.energyPerPoint;delete legacy.stamina.rarityPoints;
 for(const rule of Object.values(legacy.heroes.classes) as any[])rule.maxStamina=120;
 await prisma.runtimeSettings.create({data:{id,data:legacy}});
 const user=await prisma.user.create({data:{wallet:'migration-test-'+randomUUID(),displayName:'Temporary migration test'}});
 try{
  const fixtures=[['COMMON',120,100],['RARE',122,150],['SUPER_RARE',192,300],['EPIC',216,450],['LEGENDARY',300,600],['SUPER_LEGENDARY',384,750]] as const;
  const heroes=[];
  for(const [rarity,capacity] of fixtures)heroes.push(await prisma.hero.create({data:{userId:user.id,class:'MAGE',rarity,atk:23,spd:2,maxStamina:capacity,stamina:capacity/2,staminaUsageUnits:12000,staminaRecoveryUnits:30000}}));
  const sql=await readFile(new URL('../prisma/migrations/20261017040000_stamina_by_rarity/migration.sql',import.meta.url),'utf8');
  const commands=sql.replace(/--[^\n]*/g,'').split(';').map(part=>part.trim()).filter(part=>part&&part!=='BEGIN'&&part!=='COMMIT');
  await prisma.$transaction(async tx=>{
   await tx.$executeRawUnsafe(commands[0]+" AND \"id\"=$1",id);
   const conversion=commands[1].replace('h."rarity"::text=l.rarity','h."rarity"::text=l.rarity WHERE h."userId"=$1');
   await tx.$executeRawUnsafe(conversion,user.id);
   await tx.$executeRawUnsafe(conversion,user.id);
  });
  const migrated=await prisma.runtimeSettings.findUniqueOrThrow({where:{id}});
  assert.deepEqual(parseConfig(migrated.data).stamina,DEFAULT_CONFIG.stamina);
  for(let index=0;index<heroes.length;index++){
   const hero=await prisma.hero.findUniqueOrThrow({where:{id:heroes[index].id}});
   assert.equal(hero.maxStamina,fixtures[index][2]);assert.equal(hero.stamina,fixtures[index][2]/2);
   assert.equal(hero.atk,23);assert.equal(hero.spd,2);
   assert.equal(hero.staminaUsageUnits,12000);assert.equal(hero.staminaRecoveryUnits,30000);
  }
 }finally{await prisma.user.delete({where:{id:user.id}});}
}));
