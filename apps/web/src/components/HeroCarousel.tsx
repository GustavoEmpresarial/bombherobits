import { useEffect, useRef, useState, type CSSProperties } from "react";
import { HERO_ART } from "../lib/characters";
import { HERO_COLLECTION, COLLECTION_RARITIES } from "../lib/hero-collection";
import "./hero-carousel.css";

const heroes = [
  ...Object.values(HERO_ART).map(hero => ({
    id: hero.id, name: hero.name, label: hero.role.toUpperCase(), color: hero.color,
    image: `/characters/${hero.id}-portrait.png`, description: hero.title,
  })),
  ...HERO_COLLECTION.map(hero => ({
    id: hero.id, name: hero.name, label: COLLECTION_RARITIES[hero.rarity].label,
    color: COLLECTION_RARITIES[hero.rarity].color,
    image: `/characters/collection/pixel/${hero.id}.png`, description: hero.role,
  })),
];

export function HeroCarousel() {
  const track = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState({ index: 0, visible: 3 });
  function updatePosition() {
    const element = track.current;
    if (!element) return;
    const cards = element.querySelectorAll<HTMLElement>(".party-slide");
    const stride = cards[1].offsetLeft - cards[0].offsetLeft;
    setPosition({ index: Math.round(element.scrollLeft / stride), visible: Math.max(1, Math.round(element.clientWidth / stride)) });
  }
  useEffect(() => {
    const element = track.current;
    if (!element) return;
    const observer = new ResizeObserver(updatePosition);
    observer.observe(element); updatePosition();
    return () => observer.disconnect();
  }, []);
  function goTo(index: number) {
    const element = track.current;
    if (!element) return;
    const cards = element.querySelectorAll<HTMLElement>(".party-slide");
    const clamped = Math.max(0, Math.min(index, heroes.length - position.visible));
    element.scrollTo({
      left: cards[clamped].offsetLeft - cards[0].offsetLeft,
      behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "instant" : "smooth",
    });
  }
  const last = Math.min(heroes.length, position.index + position.visible);
  return <section className="vault-section vault-party party-carousel" id="party" aria-labelledby="party-heading" aria-roledescription="carousel">
    <div className="vault-section-heading"><span className="vault-eyebrow">MEET YOUR PARTY</span><h2 id="party-heading">Little heroes.<br/><em>A lot of character.</em></h2><p>A world of adventurers. Find your next favorite.</p></div>
    <div className="party-carousel-toolbar">
      <span className="party-carousel-count" aria-live="polite">{String(position.index + 1).padStart(2, "0")}–{String(last).padStart(2, "0")} <i>/ {heroes.length}</i></span>
      <div><button type="button" aria-label="Previous heroes" aria-controls="party-carousel-track" disabled={position.index === 0} onClick={() => goTo(position.index - 1)}>←</button><button type="button" aria-label="Next heroes" aria-controls="party-carousel-track" disabled={last >= heroes.length} onClick={() => goTo(position.index + 1)}>→</button></div>
    </div>
    <div className="party-carousel-track" id="party-carousel-track" ref={track} onScroll={updatePosition} tabIndex={0} aria-label="Hero cards. Use arrow keys or swipe to explore." onKeyDown={event => {
      if (["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) {
        event.preventDefault();
        goTo(event.key === "Home" ? 0 : event.key === "End" ? heroes.length : position.index + (event.key === "ArrowRight" ? 1 : -1));
      }
    }}>
      {heroes.map((hero, index) => <article className="party-slide" key={hero.id} style={{ "--party-color": hero.color } as CSSProperties} role="group" aria-roledescription="slide" aria-label={`${index + 1} of ${heroes.length}: ${hero.name}, ${hero.label}`}>
        <div className="party-slide-art"><span aria-hidden="true">{String(index + 1).padStart(2, "0")}</span><img src={hero.image} alt={`${hero.name}, ${hero.description}`} width="240" height="240" loading="lazy"/></div>
        <h3>{hero.name}</h3><p>{hero.label}</p>
      </article>)}
    </div>
    <div className="party-carousel-progress" aria-hidden="true"><span style={{ width: `${position.visible / heroes.length * 100}%`, left: `${position.index / heroes.length * 100}%` }}/></div>
  </section>;
}
