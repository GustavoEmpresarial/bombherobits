import type { CSSProperties } from 'react';
export type CharacterKind = 'aurek' | 'vesper' | 'cinder';
export function GameSprite({ kind = 'aurek', scale = 4 }: { kind?: CharacterKind; scale?: number }) {
  return <span className="game-sprite" aria-hidden="true" style={{
    width: 32 * scale, height: 32 * scale,
    backgroundImage: `url(/characters/${kind}-idle.png)`,
    backgroundSize: `${512 * scale}px ${128 * scale}px`,
    '--sprite-end': `${-512 * scale}px`, '--sprite-frames': 16,
    animationDuration: '2.4s',
  } as CSSProperties} />;
}
