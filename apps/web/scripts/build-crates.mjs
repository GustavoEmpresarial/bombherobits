import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { PNG } from 'pngjs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
const root = resolve(dirname(fileURLToPath(import.meta.url)), '../public');
const atlas = PNG.sync.read(readFileSync(resolve(root, 'art/source/crates-atlas.png')));
const ids = ['wooden-crate','iron-crate','gold-chest','crystal-chest','ancient-vault'];
const cw=Math.floor(atlas.width/5),ch=Math.floor(atlas.height/2);
mkdirSync(resolve(root,'loot'),{recursive:true});
for(const [col,id] of ids.entries()) {
  const ox=Math.floor(col*atlas.width/5);
  let left=cw,top=ch,right=0,bottom=0;
  for(let row=0;row<2;row++)for(let y=0;y<ch;y++)for(let x=0;x<cw;x++) {
    const sy=Math.floor(row*atlas.height/2)+y;
    if(atlas.data[(sy*atlas.width+ox+x)*4+3]>100){left=Math.min(left,x);right=Math.max(right,x);top=Math.min(top,y);bottom=Math.max(bottom,y);}
  }
  if(right<=left)throw new Error(`Empty loot cell: ${id}`);
  const sw=right-left+1,sh=bottom-top+1,scale=Math.min(24/sw,24/sh),dw=Math.round(sw*scale),dh=Math.round(sh*scale);
  const sheet=new PNG({width:64,height:32});
  for(let row=0;row<2;row++)for(let y=0;y<dh;y++)for(let x=0;x<dw;x++) {
    const sx=ox+left+Math.min(sw-1,Math.floor((x+.5)/scale));
    const sy=Math.floor(row*atlas.height/2)+top+Math.min(sh-1,Math.floor((y+.5)/scale));
    const i=(sy*atlas.width+sx)*4;
    if(atlas.data[i+3]<100)continue;
    const j=((27-dh+y)*64+row*32+Math.floor((32-dw)/2)+x)*4;
    for(let c=0;c<3;c++)sheet.data[j+c]=atlas.data[i+c];sheet.data[j+3]=255;
  }
  writeFileSync(resolve(root,`loot/${id}.png`),PNG.sync.write(sheet));
  const portrait=new PNG({width:cw,height:ch});PNG.bitblt(atlas,portrait,ox,0,cw,ch,0,0);
  writeFileSync(resolve(root,`loot/${id}-portrait.png`),PNG.sync.write(portrait));
}
console.log('Built five original containers, each with intact and damaged frames.');
