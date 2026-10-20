import type { SummonBatchDto } from "@herobits/shared";

// A refresh started before a purchase/reveal/claim must not restore older state.
export class PendingSummonTracker {
 private revision=0;
 private request=0;
 private claimed=new Set<string>();
 beginRefresh(){return {revision:this.revision,request:++this.request};}
 invalidate(){this.revision++;}
 markClaimed(id:string){this.claimed.add(id);this.invalidate();}
 accepts(stamp:{revision:number;request:number}){return stamp.revision===this.revision&&stamp.request===this.request;}
 pending(rows:SummonBatchDto[]){return rows.filter(row=>row.status!=="CLAIMED"&&!this.claimed.has(row.id));}
}

export function confirmationHold(startedAt:number,now:number,reducedMotion:boolean){
 return reducedMotion?0:Math.max(700,2600-(now-startedAt));
}
