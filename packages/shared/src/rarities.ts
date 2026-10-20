import type { HeroRarity } from "./index.js";
export const HERO_RARITIES = ["COMMON","RARE","SUPER_RARE","EPIC","LEGENDARY","SUPER_LEGENDARY"] as const;
export const RARITY_INFO: Record<HeroRarity,{name:string;color:string;rank:number;frame:number}> = {
 COMMON:{name:"Common",color:"#c9ced6",rank:0,frame:0},
 RARE:{name:"Rare",color:"#4aa8ff",rank:1,frame:2},
 SUPER_RARE:{name:"Super Rare",color:"#65e3b4",rank:2,frame:2},
 EPIC:{name:"Epic",color:"#b670ff",rank:3,frame:3},
 LEGENDARY:{name:"Legend",color:"#ffb22e",rank:4,frame:4},
 SUPER_LEGENDARY:{name:"Super Legend",color:"#ff719c",rank:5,frame:4},
};
