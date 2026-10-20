import { useEffect, useRef, useState } from "react";
import { KEEP, arenaTheme, cellCenter } from "@herobits/shared";
import { ARENA_RENDER_SCALE, LOOT_MATERIAL_FRAME, MATERIAL_REGIONS, paintArena, paintBarriers } from "../game/arena-materials";
import { createDemoWorld, DEMO_SKINS, stepDemoWorld } from "../game/demo-world";
import { BrandWordmark } from "./BrandWordmark";
import "./animated-dungeon.css";

const names = { aurek:"Aurek",vesper:"Vesper",cinder:"Cinder" };
function loadImage(src:string) {
  return new Promise<HTMLImageElement>((resolve,reject)=>{const image=new Image();image.onload=()=>resolve(image);image.onerror=reject;image.src=src;});
}
export function AnimatedDungeon({ interactive=false }: { interactive?:boolean }) {
  const canvasRef=useRef<HTMLCanvasElement>(null);
  const worldRef=useRef(createDemoWorld());
  const pausedRef=useRef(false);
  const [paused,setPaused]=useState(()=>window.matchMedia("(prefers-reduced-motion: reduce)").matches);
  const [ready,setReady]=useState(false);
  const [error,setError]=useState(false);
  const [stats,setStats]=useState({wave:1,opened:0,left:45,heroes:worldRef.current.heroes.map(hero=>({...hero}))});
  useEffect(()=>{pausedRef.current=paused;},[paused]);
  useEffect(()=>{
    let active=true,visible=true,frame=0,last=0,lastStats=0;
    const canvas=canvasRef.current!;
    const observer=new IntersectionObserver(([entry])=>{visible=entry.isIntersecting;last=0;});
    observer.observe(canvas);
    const onVisibility=()=>{last=0;};document.addEventListener("visibilitychange",onVisibility);
    async function start() {
      try {
        const atlas=await loadImage("/dungeon/realistic/materials-atlas.png");
        const sprites:Record<string,HTMLImageElement>={};
        await Promise.all(DEMO_SKINS.flatMap(skin=>["idle","walk","attack"].map(async action=>{sprites[skin+"-"+action]=await loadImage("/characters/"+skin+"-"+action+".png");})));
        if (!active) return;
        const ground=document.createElement("canvas"),barriers=document.createElement("canvas");
        for (const layer of [ground,barriers]) {layer.width=KEEP.WORLD_W*ARENA_RENDER_SCALE;layer.height=KEEP.WORLD_H*ARENA_RENDER_SCALE;}
        const renderScale=Math.min(3,Math.max(1,Math.ceil(canvas.clientWidth*window.devicePixelRatio/KEEP.WORLD_W)));
        canvas.width=KEEP.WORLD_W*renderScale;canvas.height=KEEP.WORLD_H*renderScale;
        paintArena(ground.getContext("2d")!,atlas,arenaTheme(1));
        paintBarriers(barriers.getContext("2d")!,atlas);
        const ctx=canvas.getContext("2d")!;
        setReady(true);
        function draw(now:number) {
          if (!active) return;
          frame=requestAnimationFrame(draw);
          if (!visible||document.hidden) {last=0;return;}
          const dt=last?(now-last)/1000:0;last=now;
          const world=worldRef.current;
          if (!pausedRef.current) stepDemoWorld(world,dt);
          ctx.setTransform(renderScale,0,0,renderScale,0,0);
          ctx.clearRect(0,0,KEEP.WORLD_W,KEEP.WORLD_H);
          ctx.imageSmoothingEnabled=true;ctx.drawImage(ground,0,0,KEEP.WORLD_W,KEEP.WORLD_H);
          for (const chest of world.chests) {
            const x=cellCenter(chest.x),y=cellCenter(chest.y);
            if (chest.hp>0) {
              const [sx,sy,sw,sh]=MATERIAL_REGIONS[LOOT_MATERIAL_FRAME[chest.kind]];
              ctx.drawImage(atlas,sx,sy,sw,sh,x-6,y-6,12,12);
              if (chest.hp<chest.maxHp) {ctx.fillStyle="#0a0e14";ctx.fillRect(x-5,y-9,10,2);ctx.fillStyle="#e7c464";ctx.fillRect(x-5,y-9,10*chest.hp/chest.maxHp,1);}
            }
            const age=world.time-(chest.hp>0?chest.hitAt:chest.openedAt);
            if (age>=0&&age<.45) {
              ctx.fillStyle=chest.hp>0?"#ffe7a4":"#f7c64c";
              for(let i=0;i<5;i++){const angle=i*Math.PI*2/5;ctx.fillRect(Math.round(x+Math.cos(angle)*(3+age*16)),Math.round(y+Math.sin(angle)*(3+age*16)-age*5),1,1);}
            }
          }
          for (const hero of world.heroes) {
            const sprite=sprites[hero.skin+"-"+hero.action];
            const spriteFrame=Math.floor(world.time*(hero.action==="idle"?5:9)+hero.id*2)%16;
            const row=hero.skin==="cinder"?[2,1,0,3][hero.facing]:[0,1,0,2][hero.facing];
            ctx.imageSmoothingEnabled=false;
            ctx.drawImage(sprite,spriteFrame*32,row*32,32,32,cellCenter(hero.x)-10,cellCenter(hero.y)-12,20,20);
          }
          ctx.imageSmoothingEnabled=true;
          ctx.drawImage(barriers,0,0,KEEP.WORLD_W,KEEP.WORLD_H);
          // Small torch flickers stay outside the walking lanes.
          for(let x=3;x<40;x+=6)for(const y of [0,20]){
            const [sx,sy,sw,sh]=MATERIAL_REGIONS[13],pulse=pausedRef.current?1:1+Math.sin(world.time*9+x)*.05;
            ctx.drawImage(atlas,sx,sy,sw,sh,cellCenter(x)-5,cellCenter(y)-6,10*pulse,10*pulse);
          }
          if(now-lastStats>300){lastStats=now;setStats({wave:world.wave,opened:world.opened,left:world.chests.filter(chest=>chest.hp>0).length,heroes:world.heroes.map(hero=>({...hero}))});}
        }
        frame=requestAnimationFrame(draw);
      } catch {if(active)setError(true);}
    }
    void start();
    return()=>{active=false;cancelAnimationFrame(frame);observer.disconnect();document.removeEventListener("visibilitychange",onVisibility);};
  },[]);
  const controls=<><button type="button" onClick={()=>setPaused(value=>!value)} aria-pressed={paused}>{paused?"▶ PLAY":"Ⅱ PAUSE"}</button>{interactive&&<><button type="button" onClick={()=>{for(const hero of worldRef.current.heroes)hero.working=true;setPaused(false);}}>WORK ALL</button><button type="button" onClick={()=>{for(const hero of worldRef.current.heroes)hero.working=false;}}>REST ALL</button><button type="button" onClick={()=>{worldRef.current=createDemoWorld();setPaused(false);}}>RESET DEMO</button></>}</>;
  return <div className={interactive?"dungeon-demo-page":"dungeon-loop-preview"}>
    {interactive&&<header className="demo-header"><a href="/auth" aria-label="Back to home"><BrandWordmark/></a><div><strong>DUNGEON DEMO</strong><span>Local simulation · No wallet · No real rewards</span></div><a href="/auth#whitelist">EARLY ACCESS ↗</a></header>}
    <div className="demo-layout">
      <div className="demo-arena-panel">
        <div className="demo-arena-top"><span><i/> {interactive?"DEMO ARENA":"LOOP PREVIEW"}</span><span>WAVE {stats.wave} · {stats.left} CHESTS LEFT</span><div>{!interactive&&controls}</div></div>
        <div className="demo-canvas-wrap" aria-busy={!ready&&!error}>
          {!ready&&<img src="/art/dungeon-preview-v2.png" alt="" width="1672" height="941"/>}
          <canvas ref={canvasRef} role="img" aria-label="Animated dungeon demonstration: pixel heroes walk through clear corridors and attack treasure chests; pillars and perimeter walls remain fixed." style={{visibility:ready?"visible":"hidden"}}/>
          {!ready&&<span className="demo-loading" role="status">{error?"Could not load animation. Refresh to try again.":"LOADING THE SQUAD…"}</span>}
        </div>
        <div className="demo-arena-bottom"><span>{stats.opened} CHESTS OPENED <small>· Demo only</small></span>{interactive?<div className="demo-controls">{controls}</div>:<a href="/demo">OPEN INTERACTIVE DEMO ↗</a>}</div>
      </div>
      {interactive&&<aside className="demo-roster"><span>YOUR DEMO PARTY</span><h1>Heroes at work.</h1><p>Choose who works or rests. Your demo resets when you leave.</p>{stats.heroes.map(hero=><article key={hero.id}><img src={"/characters/"+hero.skin+"-portrait.png"} alt="" width="70" height="70"/><div><h2>{names[hero.skin]} <small>#{hero.id+1}</small></h2><span>{hero.working?(paused?"Paused":hero.action==="attack"?"Opening a chest":hero.action==="walk"?"Exploring":"Ready"):"Resting"}</span></div><button type="button" onClick={()=>{const current=worldRef.current.heroes[hero.id];current.working=!current.working;setStats(previous=>({...previous,heroes:worldRef.current.heroes.map(actor=>({...actor}))}));}}>{hero.working?"REST":"WORK"}</button></article>)}</aside>}
    </div>
  </div>;
}
