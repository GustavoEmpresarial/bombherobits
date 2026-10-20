import type { CSSProperties } from 'react';
import {HERO_COLLECTION,COLLECTION_RARITIES} from '../lib/hero-collection';
import './hero-collection.css';

export function HeroCollection(){
 return <section className="hero-collection" id="hero-collection" aria-labelledby="collection-title">
  <header className="hero-collection-heading"><span>THE NEXT CHAPTER</span><h2 id="collection-title">Eight faces. <em>Endless character.</em></h2><p>A new collection of hero designs, from Rare to Super Legend.</p></header>
  <div className="hero-collection-grid">{HERO_COLLECTION.map(hero=>{
   const rarity=COLLECTION_RARITIES[hero.rarity];
   return <article className="new-hero-card" key={hero.id} data-rarity={hero.rarity} style={{'--collection-rarity':rarity.color} as CSSProperties} aria-label={`${hero.name} — ${rarity.label}`}>
    <div className="new-hero-art"><span aria-hidden="true"/><img src={`/characters/collection/pixel/${hero.id}.png`} alt={`${hero.name}, ${hero.role}`} loading="lazy" width="180" height="190"/></div>
    <h3>{hero.name}</h3><p className="new-hero-rarity">{rarity.label}</p>
   </article>;
  })}</div>
 </section>;
}
