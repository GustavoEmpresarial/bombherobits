import type { HeroClass } from '@herobits/shared';
export const HERO_ART = {
  WARRIOR: { id: 'aurek', name: 'Aurek', title: 'The Gilded Guardian', weapon: 'Sunblade', role: 'Warrior', color: '#f7bd61', description: 'A fearless beetle knight. Small in stature, unbreakable in spirit.' },
  MAGE: { id: 'vesper', name: 'Vesper', title: 'The Moonlit Wanderer', weapon: 'Moonstaff', role: 'Mage', color: '#c2a2f4', description: 'A mysterious moth mage who follows the light into the deepest dark.' },
  ROGUE: { id: 'cinder', name: 'Cinder', title: 'The Ember Outlaw', weapon: 'Crossbow', role: 'Ranger', color: '#f29672', description: 'A quick-witted fox ranger with a keen eye for trouble and treasure.' },
} as const satisfies Record<HeroClass, { id: string; name: string; title: string; weapon: string; role: string; color: string; description: string }>;
export const LOOT_ART = [
  { id: 'wooden-crate', name: 'Wooden Crate', material: 'OAK & TIMBER' },
  { id: 'iron-crate', name: 'Iron Crate', material: 'REINFORCED STEEL' },
  { id: 'gold-chest', name: 'Gold Chest', material: 'GOLD & OAK' },
  { id: 'crystal-chest', name: 'Crystal Chest', material: 'CRYSTAL & STEEL' },
  { id: 'ancient-vault', name: 'Ancient Vault', material: 'ANCIENT RELIC' },
] as const;
export type LootKind = (typeof LOOT_ART)[number]['id'];
