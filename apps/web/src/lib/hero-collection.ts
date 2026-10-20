import type { HeroRarity } from '@herobits/shared';

// Presentation collection. These designs do not alter the live summon pool.
export const HERO_COLLECTION = [
 {id:'kael',name:'Kael',rarity:'RARE',role:'Frost swordsman'},
 {id:'lyra',name:'Lyra',rarity:'SUPER_RARE',role:'Moon archer'},
 {id:'mira',name:'Mira',rarity:'EPIC',role:'Raven witch'},
 {id:'solenne',name:'Solenne',rarity:'LEGENDARY',role:'Sun paladin'},
 {id:'elowen',name:'Elowen',rarity:'LEGENDARY',role:'Woodland spellcaster'},
 {id:'raizen',name:'Raizen',rarity:'SUPER_LEGENDARY',role:'Storm dragon knight'},
 {id:'vael',name:'Vael',rarity:'SUPER_LEGENDARY',role:'Eclipse assassin'},
] as const satisfies readonly {id:string;name:string;rarity:HeroRarity;role:string}[];

export const COLLECTION_RARITIES = {
 RARE:{label:'RARE',color:'#4d9cff'},
 SUPER_RARE:{label:'SUPER RARE',color:'#8c69ff'},
 EPIC:{label:'EPIC',color:'#c54dff'},
 LEGENDARY:{label:'LEGENDARY',color:'#f4c64d'},
 SUPER_LEGENDARY:{label:'SUPER LEGEND',color:'#ff5148'},
} as const;
