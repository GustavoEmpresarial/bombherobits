import { test } from "node:test";
import assert from "node:assert/strict";
import { cellBlocked, pathBetween } from "@herobits/shared";
import { createDemoWorld, stepDemoWorld } from "../../web/src/game/demo-world.js";

test("walls have a continuous clear walking band, including all four corners",()=>{
  for(let x=1;x<40;x++)for(const y of [1,19])assert.equal(cellBlocked(x,y),false);
  for(let y=1;y<20;y++)for(const x of [1,39])assert.equal(cellBlocked(x,y),false);
  assert.equal(cellBlocked(2,2),true);
  assert.equal(cellBlocked(38,18),true);
  for(const target of [{x:39,y:1},{x:39,y:19},{x:1,y:19}])assert(pathBetween(1,1,target.x,target.y).length);
});
test("demo heroes work without entering pillars and the layout stays fixed between loops",()=>{
  const world=createDemoWorld();
  const initial=world.chests.map(({x,y,kind})=>({x,y,kind}));
  for(let tick=0;tick<6000;tick++){
    stepDemoWorld(world,1/30);
    for(const hero of world.heroes){
      assert.equal(cellBlocked(Math.round(hero.x),Math.round(hero.y)),false);
      if(hero.path.length)assert.equal(hero.x===hero.path[0].x||hero.y===hero.path[0].y,true);
    }
    for(const chest of world.chests){assert.equal(cellBlocked(chest.x,chest.y),false);assert(chest.x>=1&&chest.x<=39&&chest.y>=1&&chest.y<=19);}
  }
  assert(world.opened>45);
  assert(world.wave>1);
  assert.deepEqual(world.chests.map(({x,y,kind})=>({x,y,kind})),initial);
});
test("resting freezes working decisions without teleporting a hero into obstacles",()=>{
  const world=createDemoWorld();
  for(let i=0;i<120;i++)stepDemoWorld(world,1/30);
  for(const hero of world.heroes)hero.working=false;
  for(let i=0;i<120;i++)stepDemoWorld(world,1/30);
  const positions=world.heroes.map(hero=>[hero.x,hero.y]),opened=world.opened;
  for(let i=0;i<120;i++)stepDemoWorld(world,1/30);
  assert.deepEqual(world.heroes.map(hero=>[hero.x,hero.y]),positions);
  assert.equal(world.opened,opened);
});
