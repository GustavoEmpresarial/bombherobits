import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { authenticate } from "../lib/auth.js";
import { pendingSummons,purchaseSummon,revealSummon,claimSummon } from "../services/summon-batches.js";
const purchaseSchema=z.object({count:z.number().int().min(1).max(50),requestId:z.string().uuid()}).strict();
const batchSchema=z.object({id:z.string().min(1).max(100)});
export async function summonRoutes(app:FastifyInstance){
 app.get("/heroes/summons/pending",{preHandler:authenticate},async(request,reply)=>{
  reply.header("Cache-Control","no-store");return pendingSummons(request.user.id);
 });
 for(const [url,source]of [["/heroes/summon","GOLD"],["/chest/open","CARDS"]] as const){
  app.post(url,{preHandler:authenticate},async(request,reply)=>{
   const body=purchaseSchema.safeParse(request.body);
   if(!body.success)return reply.code(400).send({error:"Invalid pack or purchase request"});
   try{return await purchaseSummon(request.user.id,body.data.count,source,body.data.requestId);}
   catch(error){const err=error as Error&{statusCode?:number};if(err.statusCode)return reply.code(err.statusCode).send({error:err.message});throw error;}
  });
 }
 for(const [action,handler] of [["reveal",revealSummon],["claim",claimSummon]] as const){
  app.post("/heroes/summons/:id/"+action,{preHandler:authenticate},async(request,reply)=>{
   const params=batchSchema.safeParse(request.params);
   if(!params.success)return reply.code(400).send({error:"Invalid summon pack"});
   try{return await handler(request.user.id,params.data.id);}
   catch(error){const err=error as Error&{statusCode?:number};if(err.statusCode)return reply.code(err.statusCode).send({error:err.message});throw error;}
  });
 }
}
