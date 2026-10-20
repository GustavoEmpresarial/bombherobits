import { cellBlocked, pathBetween } from "@herobits/shared";

export const DEMO_SKINS = ["aurek", "vesper", "cinder"] as const;
export const DEMO_LOOT = ["wooden-crate", "iron-crate", "gold-chest", "crystal-chest", "ancient-vault"] as const;
type Cell = { x: number; y: number };
export type DemoChest = Cell & { id: number; kind: typeof DEMO_LOOT[number]; hp: number; maxHp: number; hitAt: number; openedAt: number };
export type DemoActor = Cell & { id: number; skin: typeof DEMO_SKINS[number]; working: boolean; path: Cell[]; target: number | null; attackAt: number; facing: number; action: "idle" | "walk" | "attack" };
export type DemoWorld = { time: number; wave: number; opened: number; nextWaveAt: number; heroes: DemoActor[]; chests: DemoChest[] };
function spawnChests(): DemoChest[] {
  const cells: Cell[] = [];
  for (let y = 1; y <= 19; y++) for (let x = 1; x <= 39; x++) if (!cellBlocked(x,y)) cells.push({ x,y });
  let seed = 71423;
  for (let i = cells.length-1; i > 0; i--) {
    seed = (Math.imul(seed,1664525)+1013904223)>>>0;
    const j = seed % (i+1); [cells[i],cells[j]]=[cells[j],cells[i]];
  }
  return cells.slice(0,45).map((cell,id) => ({ ...cell,id,kind:DEMO_LOOT[id%5],hp:40+(id%5)*15,maxHp:40+(id%5)*15,hitAt:-10,openedAt:-10 }));
}
export function createDemoWorld(): DemoWorld {
  const starts = [{x:1,y:1},{x:39,y:19},{x:1,y:19},{x:39,y:1},{x:1,y:10},{x:39,y:10}];
  return { time:0,wave:1,opened:0,nextWaveAt:0,chests:spawnChests(),heroes:starts.map((cell,id)=>({...cell,id,skin:DEMO_SKINS[id%3],working:true,path:[],target:null,attackAt:0,facing:0,action:"idle"})) };
}
function plan(world: DemoWorld, hero: DemoActor) {
  const occupied = new Set(world.chests.filter(chest=>chest.hp>0).map(chest=>`${chest.x},${chest.y}`));
  const claimed = new Set(world.heroes.filter(other=>other.id!==hero.id&&other.working).map(other=>other.target));
  const candidates = world.chests.filter(chest=>chest.hp>0&&!claimed.has(chest.id)).sort((a,b)=>(Math.abs(a.x-hero.x)+Math.abs(a.y-hero.y))-(Math.abs(b.x-hero.x)+Math.abs(b.y-hero.y)));
  for (const chest of candidates) {
    const neighbors = [{x:chest.x-1,y:chest.y},{x:chest.x+1,y:chest.y},{x:chest.x,y:chest.y-1},{x:chest.x,y:chest.y+1}]
      .filter(cell=>!cellBlocked(cell.x,cell.y)&&!occupied.has(`${cell.x},${cell.y}`))
      .sort((a,b)=>(Math.abs(a.x-hero.x)+Math.abs(a.y-hero.y))-(Math.abs(b.x-hero.x)+Math.abs(b.y-hero.y)));
    for (const cell of neighbors) {
      const path = pathBetween(hero.x,hero.y,cell.x,cell.y,occupied);
      if (path.length || (hero.x===cell.x&&hero.y===cell.y)) { hero.target=chest.id;hero.path=path;hero.attackAt=world.time+.3;return; }
    }
  }
}
export function stepDemoWorld(world: DemoWorld, dt: number) {
  const elapsed=Math.min(.1,Math.max(0,dt));world.time+=elapsed;
  for (const hero of world.heroes) {
    hero.action="idle";
    // Complete the current cell segment before resting, so a resumed actor never cuts a corner.
    if (!hero.working && Number.isInteger(hero.x)&&Number.isInteger(hero.y)) {hero.target=null;hero.path=[];continue;}
    if (hero.target===null && hero.working) plan(world,hero);
    if (hero.path.length) {
      const next=hero.path[0],dx=next.x-hero.x,dy=next.y-hero.y,distance=Math.abs(dx)+Math.abs(dy),movement=elapsed*3;
      hero.facing=Math.abs(dx)>0?(dx>0?2:1):(dy>0?0:3);hero.action="walk";
      if (movement>=distance) {hero.x=next.x;hero.y=next.y;hero.path.shift();}
      else {hero.x+=Math.sign(dx)*movement;hero.y+=Math.sign(dy)*movement;}
      continue;
    }
    if (!hero.working) continue;
    const chest=world.chests.find(chest=>chest.id===hero.target&&chest.hp>0);
    if (!chest) {hero.target=null;continue;}
    // Never attack from across a barrier or from a distant stale target.
    if (Math.abs(hero.x-chest.x)+Math.abs(hero.y-chest.y)!==1) {hero.target=null;continue;}
    hero.facing=chest.x!==hero.x?(chest.x>hero.x?2:1):(chest.y>hero.y?0:3);
    hero.action="attack";
    if (world.time>=hero.attackAt) {
      hero.attackAt=world.time+.65;chest.hitAt=world.time;chest.hp=Math.max(0,chest.hp-20);
      if (!chest.hp) {chest.openedAt=world.time;world.opened++;hero.target=null;}
    }
  }
  if (world.chests.every(chest=>chest.hp===0)) {
    if (!world.nextWaveAt) world.nextWaveAt=world.time+2;
    if (world.time>=world.nextWaveAt) {
      // Same floor, barriers and chest locations every loop; only treasure is replenished.
      world.chests=spawnChests();world.wave++;world.nextWaveAt=0;
      for (const hero of world.heroes) {hero.target=null;hero.path=[];hero.x=Math.round(hero.x);hero.y=Math.round(hero.y);}
    }
  }
}
