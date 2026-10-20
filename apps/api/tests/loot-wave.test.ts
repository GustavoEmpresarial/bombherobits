import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULT_CONFIG, LOOT_KINDS, ARENA_THEMES, arenaTheme } from '@herobits/shared';
import { rollWaveLoot } from '../src/services/loot-wave.js';

test('a standard wave has 60 assorted chests and includes every enabled model', () => {
 const kinds = rollWaveLoot(DEFAULT_CONFIG.game.TARGET_COUNT, DEFAULT_CONFIG.crates);
 assert.equal(kinds.length, 60);
 assert.deepEqual(new Set(kinds), new Set(LOOT_KINDS));
});
test('disabled chest models never spawn; a single enabled model fills the wave', () => {
 const crates=structuredClone(DEFAULT_CONFIG.crates);
 for(const rule of Object.values(crates))rule.weight=0;
 crates['gold-chest'].weight=100;
 assert.deepEqual(rollWaveLoot(60,crates),Array(60).fill('gold-chest'));
 assert.deepEqual(rollWaveLoot(0,crates),[]);
});
test('small custom waves respect capacity while using enabled chest weights', () => {
 const crates=structuredClone(DEFAULT_CONFIG.crates);crates['wooden-crate'].weight=0;
 const kinds=rollWaveLoot(3,crates,()=>0);
 assert.equal(kinds.length,3);assert(kinds.every(kind=>kind==='iron-crate'));
});
test('the dungeon keeps the same appearance across waves and reloads', () => {
 for (const wave of [1,2,3,4,5,6,30,1000,0,Number.NaN]) assert.equal(arenaTheme(wave),ARENA_THEMES[0]);
});
