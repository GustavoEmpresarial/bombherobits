import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { randomBytes } from "node:crypto";
import { z } from "zod";
import { DEFAULT_CONFIG, type ConfigSection } from "@herobits/shared";
import { prisma } from "../lib/prisma.js";
import { equalHash, hashPassword, tokenHash, verifyPassword } from "../lib/admin-crypto.js";
import { getSettings, saveSection } from "../services/config.js";
import { ADMIN_PAGE } from "../admin/admin-page.js";

type Options={path?:string;accessHash?:string};
export async function adminRoutes(app:FastifyInstance, options:Options={}){
 const path=options.path??process.env.ADMIN_PATH;const accessHash=options.accessHash??process.env.ADMIN_ACCESS_TOKEN_HASH;
 if(!path||!accessHash||!/^\/_ops-[a-zA-Z0-9_-]{16,64}$/.test(path)||!/^([a-f0-9]{64})$/.test(accessHash))return;
 const cookieName='herobits_admin';const attempts=new Map<string,{count:number;until:number}>();const dummy=await hashPassword(randomBytes(32).toString('hex'));
 const cookie=(value:string,maxAge:number)=>cookieName+'='+value+'; HttpOnly; SameSite=Strict; Path='+path+'; Max-Age='+maxAge+(process.env.NODE_ENV==='production'?'; Secure':'');
 const unauthorized=(reply:FastifyReply)=>reply.code(404).send({error:'Not found'});
 function limited(ip:string){const now=Date.now();let row=attempts.get(ip);if(!row||row.until<=now){row={count:0,until:now+15*60_000};attempts.set(ip,row);}row.count++;if(attempts.size>2000)for(const [key,value]of attempts)if(value.until<now)attempts.delete(key);return row.count>5;}
 async function gate(request:FastifyRequest,reply:FastifyReply){
  reply.header('Cache-Control','no-store').header('X-Robots-Tag','noindex, nofollow').header('Referrer-Policy','no-referrer').header('X-Content-Type-Options','nosniff');
  if(request.headers['sec-fetch-site']==='cross-site')return unauthorized(reply);
  const origin=request.headers.origin;if(origin&&origin!==request.protocol+'://'+request.headers.host)return unauthorized(reply);
  const token=request.headers['x-admin-access'];if(typeof token!=='string'||token.length>256||!equalHash(token,accessHash!))return unauthorized(reply);
 }
 async function session(request:FastifyRequest,reply:FastifyReply){
  await gate(request,reply);if(reply.sent)return;
  const raw=request.headers.cookie?.split(';').map(part=>part.trim()).find(part=>part.startsWith(cookieName+'='))?.slice(cookieName.length+1);
  if(!raw||raw.length>256)return reply.code(401).send({error:'Admin session required'});
  const row=await prisma.adminSession.findUnique({where:{tokenHash:tokenHash(raw)},include:{admin:true}});
  if(!row||row.expiresAt.getTime()<=Date.now()||row.admin.disabled)return reply.code(401).send({error:'Admin session expired'});
  (request as FastifyRequest&{adminId:string}).adminId=row.adminId;
 }
 app.get(path,async(_request,reply)=>{const nonce=randomBytes(18).toString('base64');return reply.header('Cache-Control','no-store').header('X-Robots-Tag','noindex, nofollow').header('Referrer-Policy','no-referrer').header('X-Content-Type-Options','nosniff').header('Content-Security-Policy',"default-src 'none'; script-src 'nonce-"+nonce+"'; style-src 'nonce-"+nonce+"'; connect-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'self'").type('text/html; charset=utf-8').send(ADMIN_PAGE.replaceAll('__NONCE__',nonce));});
 app.post(path+'/api/login',{bodyLimit:4096},async(request,reply)=>{
  if(limited(request.ip))return reply.code(429).send({error:'Too many attempts. Please wait 15 minutes.'});
  await gate(request,reply);if(reply.sent)return;
  const body=z.object({username:z.string().trim().min(1).max(80),password:z.string().min(1).max(256)}).strict().safeParse(request.body);
  if(!body.success)return reply.code(400).send({error:'Invalid credentials'});
  const user=await prisma.adminUser.findUnique({where:{username:body.data.username}});
  const valid=await verifyPassword(body.data.password,user?.passwordHash??dummy);
  if(!user||!valid||user.disabled)return reply.code(401).send({error:'Invalid credentials'});
  attempts.delete(request.ip);const value=randomBytes(32).toString('base64url');
  await prisma.adminSession.deleteMany({where:{expiresAt:{lt:new Date()}}});
  await prisma.adminSession.create({data:{adminId:user.id,tokenHash:tokenHash(value),expiresAt:new Date(Date.now()+3600_000)}});
  return reply.header('Set-Cookie',cookie(value,3600)).send({username:user.username});
 });
 app.get(path+'/api/settings',{preHandler:session},async()=>getSettings());
 app.get(path+'/api/creators',{preHandler:session},async(request,reply)=>{
  const query=z.object({page:z.coerce.number().int().min(1).max(10000).default(1)}).safeParse(request.query);
  if(!query.success)return reply.code(400).send({error:'Invalid page'});
  const page=query.data.page;
  const [applications,total]=await Promise.all([
   prisma.creatorApplication.findMany({orderBy:[{createdAt:'desc'},{id:'desc'}],skip:(page-1)*25,take:25}),
   prisma.creatorApplication.count(),
  ]);
  return {applications,total,page};
 });
 app.get(path+'/api/whitelist',{preHandler:session},async(request,reply)=>{
  const query=z.object({page:z.coerce.number().int().min(1).max(10000).default(1)}).safeParse(request.query);
  if(!query.success)return reply.code(400).send({error:'Invalid page'});
  const page=query.data.page;
  const [applications,total]=await Promise.all([
   prisma.whitelistApplication.findMany({orderBy:[{createdAt:'desc'},{id:'desc'}],skip:(page-1)*25,take:25}),
   prisma.whitelistApplication.count(),
  ]);
  return {applications,total,page};
 });
 app.patch(path+'/api/whitelist/:id',{preHandler:session,bodyLimit:1024},async(request,reply)=>{
  const parsed=z.object({status:z.enum(['PENDING','APPROVED','DECLINED'])}).strict().safeParse(request.body);
  const id=(request.params as {id:string}).id;
  if(!parsed.success||id.length>64)return reply.code(400).send({error:'Invalid review'});
  const result=await prisma.whitelistApplication.updateMany({where:{id},data:{status:parsed.data.status,reviewedAt:parsed.data.status==='PENDING'?null:new Date()}});
  if(!result.count)return reply.code(404).send({error:'Application not found'});
  return {ok:true};
 });
 app.patch(path+'/api/creators/:id',{preHandler:session,bodyLimit:1024},async(request,reply)=>{
  const parsed=z.object({status:z.enum(['PENDING','APPROVED','DECLINED'])}).strict().safeParse(request.body);
  const id=(request.params as {id:string}).id;
  if(!parsed.success||id.length>64)return reply.code(400).send({error:'Invalid review'});
  const result=await prisma.creatorApplication.updateMany({where:{id},data:{status:parsed.data.status,reviewedAt:parsed.data.status==='PENDING'?null:new Date()}});
  if(!result.count)return reply.code(404).send({error:'Application not found'});
  return {ok:true};
 });
 app.put(path+'/api/settings/:section',{preHandler:session,bodyLimit:65536},async(request,reply)=>{
  const section=(request.params as {section:string}).section;if(!Object.hasOwn(DEFAULT_CONFIG,section))return unauthorized(reply);
  const body=z.object({revision:z.number().int().positive(),value:z.unknown()}).strict().safeParse(request.body);if(!body.success)return reply.code(400).send({error:'Invalid settings format'});
  try{return await saveSection((request as FastifyRequest&{adminId:string}).adminId,section as ConfigSection,body.data.value,body.data.revision);}
  catch(error){if(error instanceof z.ZodError)return reply.code(400).send({error:error.issues.map(issue=>issue.path.join('.')+': '+issue.message).join('; ')});const err=error as Error&{statusCode?:number};if(err.statusCode)return reply.code(err.statusCode).send({error:err.message});throw error;}
 });
 app.get(path+'/api/audit',{preHandler:session},async()=>({changes:await prisma.adminChange.findMany({orderBy:{createdAt:'desc'},take:50,select:{id:true,section:true,revision:true,createdAt:true,admin:{select:{username:true}}}})}));
 app.post(path+'/api/logout',{preHandler:session},async(request,reply)=>{const raw=request.headers.cookie?.split(';').map(part=>part.trim()).find(part=>part.startsWith(cookieName+'='))?.slice(cookieName.length+1);if(raw)await prisma.adminSession.deleteMany({where:{tokenHash:tokenHash(raw)}});return reply.header('Set-Cookie',cookie('',0)).send({ok:true});});
}
