import {test} from 'node:test';
import assert from 'node:assert/strict';
import type {SummonBatchDto} from '@herobits/shared';
import {PendingSummonTracker,confirmationHold} from '../../web/src/state/summon-flow.js';
const batch=(id:string,status:SummonBatchDto['status']='REVEALED')=>({id,status,count:1,requestId:id,source:'GOLD',createdAt:'2026-10-16T00:00:00Z'} as SummonBatchDto);
test('a pending response captured before claiming cannot restore the claimed pack',async()=>{
 const tracker=new PendingSummonTracker(),pack=batch('claimed');let resolve!:(rows:SummonBatchDto[])=>void;
 const oldResponse=new Promise<SummonBatchDto[]>(done=>{resolve=done}),stamp=tracker.beginRefresh();
 tracker.invalidate();tracker.markClaimed(pack.id);
 resolve([pack]);const rows=await oldResponse;
 assert.equal(tracker.accepts(stamp),false);
 assert.deepEqual(tracker.pending(rows),[]);
});
test('only the latest refresh from the current mutation revision is accepted',()=>{
 const tracker=new PendingSummonTracker(),first=tracker.beginRefresh(),second=tracker.beginRefresh();
 assert.equal(tracker.accepts(first),false);assert.equal(tracker.accepts(second),true);
 tracker.invalidate();assert.equal(tracker.accepts(second),false);
 assert.equal(tracker.accepts(tracker.beginRefresh()),true);
});
test('claimed packs stay excluded without hiding a separate unfinished pack',()=>{
 const tracker=new PendingSummonTracker();tracker.markClaimed('a');
 assert.deepEqual(tracker.pending([batch('a'),batch('b','SEALED'),batch('c','CLAIMED')]).map(row=>row.id),['b']);
});
test('fast confirmation remains visible for 2.6 seconds; slow requests get a success beat',()=>{
 assert.equal(confirmationHold(100,120,false),2580);
 assert.equal(confirmationHold(100,2000,false),700);
 assert.equal(confirmationHold(100,5100,false),700);
 assert.equal(confirmationHold(100,120,true),0);
});
