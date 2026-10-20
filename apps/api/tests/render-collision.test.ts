import { test } from 'node:test';
import assert from 'node:assert/strict';
import { KEEP, cellBlocked, cellCenter } from '@herobits/shared';
import { lootDisplaySize, visualWalkWaypoints } from '../../web/src/game/arena-layout.js';

test('treasure art fits inside its cell even with oversized visual settings',()=>{
 assert.equal(lootDisplaySize(),12);
 for(const scale of [0.2,0.6,1,2,5]) assert(lootDisplaySize(scale)<=KEEP.CELL-2);
});
test('an interrupted walking animation cannot cut diagonally through a pillar',()=>{
 for(const start of [{x:40,y:58,toX:2,toY:1},{x:58,y:40,toX:1,toY:2}]) {
  const waypoints=visualWalkWaypoints(start.x,start.y,start.toX,start.toY);
  assert(waypoints.length>=2);
  let from={x:start.x,y:start.y};
  for(const point of waypoints){
   assert(from.x===point.x||from.y===point.y,'every animated segment follows a corridor');
   for(let i=0;i<=50;i++) {
    const x=Math.floor((from.x+(point.x-from.x)*i/50-KEEP.ORIGIN)/KEEP.CELL);
    const y=Math.floor((from.y+(point.y-from.y)*i/50-KEEP.ORIGIN)/KEEP.CELL);
    assert.equal(cellBlocked(x,y),false,'animation never enters a blocked cell');
   }
   from=point;
  }
  assert.deepEqual(waypoints.at(-1),{x:cellCenter(start.toX),y:cellCenter(start.toY)});
 }
});
test('the animation planner rejects pillar and perimeter destinations',()=>{
 assert.deepEqual(visualWalkWaypoints(40,40,4,4),[]);
 assert.deepEqual(visualWalkWaypoints(40,40,0,1),[]);
});
