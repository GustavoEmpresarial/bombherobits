export const ARENA_THEMES = [
  { id: 'vault', name: 'THE FORGOTTEN VAULT', floor: 0x96b0bb, floorDark: 0x7d95a3, block: 0x7e99ab, wall: 0xd9dfdf, banner: 0xc3a06b, glow: 0xffce88, accent: '#8edbd2', background: '#0b1520' },
  { id: 'frost', name: 'THE FROSTBOUND KEEP', floor: 0x9fcde3, floorDark: 0x81a9d3, block: 0x90b5d9, wall: 0xaccbe8, banner: 0x70b7e5, glow: 0x8ddfff, accent: '#a5e4ff', background: '#0b1627' },
  { id: 'ember', name: 'THE EMBER FORGE', floor: 0xd9a583, floorDark: 0xb98270, block: 0xbf8d78, wall: 0xd1ad95, banner: 0xff9e60, glow: 0xff9563, accent: '#ffc08d', background: '#20130f' },
  { id: 'amethyst', name: 'THE AMETHYST CRYPT', floor: 0xb5a0d7, floorDark: 0x9383ba, block: 0xa18cc5, wall: 0xc1ace0, banner: 0xc48fea, glow: 0xd5a5ff, accent: '#d5b5ff', background: '#181124' },
  { id: 'grove', name: 'THE EMERALD RUINS', floor: 0x96c59d, floorDark: 0x769e85, block: 0x87af94, wall: 0xb4c8a8, banner: 0x98cf86, glow: 0xa8ed9a, accent: '#b6e5a1', background: '#0e1c16' },
] as const;

// Waves replenish treasure within the same dungeon; they do not change its identity.
export function arenaTheme(_wave: number) {
  return ARENA_THEMES[0];
}
