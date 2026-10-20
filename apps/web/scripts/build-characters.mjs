import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { PNG } from 'pngjs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
const root = resolve(dirname(fileURLToPath(import.meta.url)), '../public');
const source = PNG.sync.read(readFileSync(resolve(root, 'art/source/characters-atlas.png')));
const cw = Math.floor(source.width / 4), ch = Math.floor(source.height / 8);
const ox = (f) => Math.floor(f * source.width / 4), oy = (r) => Math.floor(r * source.height / 8);
const ids = ['aurek','vesper','cinder'];
mkdirSync(resolve(root,'characters'), { recursive:true });
const put=(img,x,y,rgba)=>{ if(x<0||y<0||x>=img.width||y>=img.height)return;const i=(y*img.width+x)*4;for(let c=0;c<4;c++)img.data[i+c]=rgba[c]; };
for (let row=0;row<3;row++) {
  // Measure all frames together to retain breathing motion and a consistent scale.
  let left=cw,top=ch,right=0,bottom=0;
  for(let f=0;f<4;f++)for(let y=0;y<ch;y++)for(let x=0;x<cw;x++) {
    if(source.data[(((oy(row)+y)*source.width+ox(f)+x)*4)+3]>100) { left=Math.min(left,x);right=Math.max(right,x);top=Math.min(top,y);bottom=Math.max(bottom,y); }
  }
  if(right<=left) throw new Error(`Missing character ${ids[row]}`);
  const sw=right-left+1,sh=bottom-top+1,ratio=Math.min(24/sw,25/sh),dw=Math.round(sw*ratio),dh=Math.round(sh*ratio);
  const frames=[];
  for(let f=0;f<4;f++) {
    const frame=new PNG({width:32,height:32});
    for(let y=0;y<dh;y++)for(let x=0;x<dw;x++) {
      const sx=ox(f)+left+Math.min(sw-1,Math.floor((x+.5)/ratio)),sy=oy(row)+top+Math.min(sh-1,Math.floor((y+.5)/ratio));
      const i=(sy*source.width+sx)*4;
      const rgba=Array.from(source.data.subarray(i,i+4));
      // Hard alpha protects the intentional pixel grid when enlarged.
      if(rgba[3]<100)continue;rgba[3]=255;
      put(frame,Math.floor((32-dw)/2)+x,28-dh+y,rgba);
    }
    frames.push(frame);
  }
  for(const action of (row<3?['idle','walk','attack']:['idle'])) {
    const out=new PNG({width:512,height:128});
    for(let dir=0;dir<4;dir++)for(let f=0;f<16;f++)for(let y=0;y<32;y++)for(let x=0;x<32;x++) {
      const frame=frames[f%4],i=(y*32+x)*4;
      if(!frame.data[i+3])continue;
      const mirror=dir===1||dir===3;
      const bob=action==='walk'?[0,-1,0,1][f%4]:0;
      const thrust=action==='attack'?[0,1,2,1][f%4]:0;
      const px=mirror?31-x:x;
      const nx=px+(mirror?-thrust:thrust),ny=y+bob;
      if(nx>=0&&nx<32&&ny>=0&&ny<32)put(out,f*32+nx,dir*32+ny,Array.from(frame.data.subarray(i,i+4)));
    }
    writeFileSync(resolve(root,`characters/${ids[row]}-${action}.png`),PNG.sync.write(out));
  }
  // High-resolution original portrait: the first production atlas cell, no old art.
  const portrait=new PNG({width:cw,height:ch});
  PNG.bitblt(source,portrait,0,oy(row),cw,ch,0,0);
  writeFileSync(resolve(root,`characters/${ids[row]}-portrait.png`),PNG.sync.write(portrait));
}
// Replace old hero navigation artwork with the new beetle-knight sprite.
const knight=PNG.sync.read(readFileSync(resolve(root,'characters/aurek-idle.png')));
const icon=new PNG({width:32,height:32});PNG.bitblt(knight,icon,0,0,32,32,0,0);
writeFileSync(resolve(root,'ui/icon-hero.png'),PNG.sync.write(icon));
console.log(`Built 3 original heroes, 3 portraits, 9 animation sheets from ${source.width}×${source.height} source.`);
const services = PNG.sync.read(readFileSync(resolve(root, 'art/source/services-atlas.png')));
for (const [column, name] of ['summon-cards','forge','porter'].entries()) {
  const left = Math.floor(column * services.width / 3), right = Math.floor((column + 1) * services.width / 3);
  const output = new PNG({ width: right-left, height: services.height });
  PNG.bitblt(services,output,left,0,right-left,services.height,0,0);
  writeFileSync(resolve(root,`shop/${name}.png`),PNG.sync.write(output));
}
console.log('Built original summoning cards, forge and clockwork porter.');

await import('./build-crates.mjs');
