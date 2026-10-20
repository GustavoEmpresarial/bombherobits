import { useEffect, useRef, useState, type CSSProperties } from "react";
import type { CharacterKind } from "./GameSprite";

// Original 32px frames, enlarged by an exact 4× with no image interpolation.
export function PartySprite({ kind, working, active }: { kind: CharacterKind; working: boolean; active: boolean }) {
  const ref = useRef<HTMLSpanElement>(null);
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const observer = new IntersectionObserver(([entry]) => setVisible(entry.isIntersecting));
    if (ref.current) observer.observe(ref.current);
    return () => observer.disconnect();
  }, []);
  return <span ref={ref} className="hero-party-sprite" data-working={working} aria-hidden="true" style={{
    "--sprite-center-x": `${kind === "aurek" ? working ? -6 : -2 : working ? -4 : 0}px`,
    "--sprite-center-y": `${kind === "aurek" ? -10 : kind === "vesper" ? -4 : -2}px`,
    backgroundImage: `url(/characters/${kind}-${working ? "attack" : "idle"}.png)`,
    animationPlayState: active && visible ? "running" : "paused",
  } as CSSProperties} />;
}
