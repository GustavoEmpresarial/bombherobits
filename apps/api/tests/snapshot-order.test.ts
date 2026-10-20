import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { DungeonSnapshot } from '@herobits/shared';
import { selectDungeonSnapshot } from '../../web/src/game/snapshot-order.js';
const state=(wave:number,combatSequence:number,time:number,runId='run')=>({wave,combatSequence,lastTickAt:new Date(time).toISOString(),runId}) as DungeonSnapshot;
test('a delayed previous wave cannot replace newly spawned treasure',()=>{
 const current=state(7,300,10000);assert.equal(selectDungeonSnapshot(current,state(6,300,10000)),current);
});
test('an older combat response cannot restore destroyed chests',()=>{
 const current=state(7,302,12000);assert.equal(selectDungeonSnapshot(current,state(7,301,13000)),current);
});
test('older equal-sequence updates cannot rewind party positions or balances',()=>{
 const current=state(7,302,12000);assert.equal(selectDungeonSnapshot(current,state(7,302,11000)),current);
});
test('new snapshots and new runs still advance normally',()=>{
 const current=state(7,302,12000),next=state(8,302,13000),newRun=state(1,0,14000,'next-run');
 assert.equal(selectDungeonSnapshot(null,current),current);assert.equal(selectDungeonSnapshot(current,next),next);assert.equal(selectDungeonSnapshot(next,newRun),newRun);assert.equal(selectDungeonSnapshot(newRun,current),newRun);
});
