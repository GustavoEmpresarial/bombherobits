import type { LootKind } from '../lib/characters';
export function LootSprite({ kind, scale = 3 }: { kind: LootKind; scale?: number }) {
  return <span className="loot-sprite" aria-hidden="true" style={{width:32*scale,height:32*scale,backgroundImage:`url(/loot/${kind}.png)`,backgroundSize:`${64*scale}px ${32*scale}px`}} />;
}
