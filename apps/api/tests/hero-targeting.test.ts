import { test } from 'node:test';
import assert from 'node:assert/strict';
import { canAttackTarget, planHeroHunt } from '../src/services/hero-targeting.js';
const near = { id: 'blocked', x: 3, y: 1 };
const far = { id: 'available', x: 1, y: 5 };
const occupied = (targets: {x:number;y:number}[], extra: string[] = []) => new Set([...targets.map(t => t.x+','+t.y),...extra]);

test('a hero switches from an enclosed nearby chest to a reachable chest', () => {
 const targets = [near,far];
 const plan=planHeroHunt({x:1,y:1},targets,1,occupied(targets,['1,1','2,1','3,2','4,1']))!;
 assert.equal(plan.target.id,far.id);
 assert.deepEqual(plan.path,[{x:1,y:2},{x:1,y:3},{x:1,y:4}]);
});
test('a mage attacks an available chest immediately instead of chasing a blocked nearer chest', () => {
 const other={id:'clear-shot',x:1,y:4},targets=[near,other];
 const plan=planHeroHunt({x:1,y:1},targets,3,occupied(targets,['1,1','2,1']))!;
 assert.equal(plan.target.id,other.id);assert.deepEqual(plan.path,[]);
});
test('target selection minimizes real walking distance around walls and heroes', () => {
 // Use the inner grid: the perimeter is now deliberately free of pillars.
 const targets=[{id:'blocked',x:5,y:3},{id:far.id,x:3,y:7}];
 const plan=planHeroHunt({x:3,y:3},targets,1,occupied(targets,['3,3','4,3','6,3']))!;
 assert.equal(plan.target.id,far.id);assert.equal(plan.path.length,3);
});
test('ranged heroes stop at a clear firing position instead of walking next to the chest', () => {
 const target={id:'ranged',x:5,y:3};
 const plan=planHeroHunt({x:1,y:3},[target],3,occupied([target],['1,3']))!;
 assert.deepEqual(plan.path,[{x:2,y:3}]);
 assert(canAttackTarget(plan.path.at(-1)!,target,3,occupied([target])));
});
test('walls, chests and friendly heroes block projectiles', () => {
 assert.equal(canAttackTarget({x:3,y:4},{x:5,y:4},3,new Set()),false);
 assert.equal(canAttackTarget({x:1,y:3},{x:5,y:3},5,new Set(['3,3'])),false);
 const targets=[{id:'front',x:3,y:3},{id:'back',x:5,y:3}];
 const plan=planHeroHunt({x:1,y:3},targets,5,occupied(targets))!;
 assert.equal(plan.target.id,'front');assert.deepEqual(plan.path,[]);
});
test('a temporary blockage is reconsidered as soon as a route opens', () => {
 const blocked=occupied([far],['1,1','1,2','2,1']);
 assert.equal(planHeroHunt({x:1,y:1},[far],1,blocked),null);
 blocked.delete('1,2');
 assert.equal(planHeroHunt({x:1,y:1},[far],1,blocked)!.target.id,far.id);
});
test('destroyed targets are dropped and another target is chosen on the next plan', () => {
 const available={id:'next',x:1,y:4};
 const targets=new Map([near,available].map(t=>[t.id,t]));
 const cells=occupied([...targets.values()],['2,1']);
 assert.equal(planHeroHunt({x:2,y:1},targets.values(),1,cells)!.target.id,near.id);
 targets.delete(near.id);cells.delete('3,1');
 const next=planHeroHunt({x:2,y:1},targets.values(),1,cells)!;
 assert.equal(next.target.id,available.id);assert(next.path.length>0);
});
test('a hero never steps onto a chest, and an old overlapping position can escape', () => {
 const target={id:'overlap',x:3,y:1};
 const plan=planHeroHunt({x:3,y:1},[target],1,occupied([target]))!;
 assert.equal(plan.path.length,1);
 assert.notDeepEqual(plan.path[0],{x:3,y:1});
 assert(canAttackTarget(plan.path[0],target,1,occupied([target])));
 assert.equal(planHeroHunt({x:1,y:1},[],1,new Set()),null);
});
