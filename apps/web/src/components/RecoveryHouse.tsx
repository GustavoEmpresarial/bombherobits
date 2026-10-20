import { useEffect, useRef, useState, type CSSProperties } from "react";
import { recoveryHouse } from "../lib/houses";
import "./recovery-houses.css";

export function RecoveryHouse({ tier, active = false }: { tier: number; active?: boolean }) {
  const house = recoveryHouse(tier);
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const observer = new IntersectionObserver(([entry]) => setVisible(entry.isIntersecting));
    if (ref.current) observer.observe(ref.current);
    return () => observer.disconnect();
  }, []);
  return <div ref={ref} className="recovery-house-art" data-active={active} data-visible={visible} style={{
    "--house-accent": house.color,
    "--chimney-x": `${house.chimney[0]}%`, "--chimney-y": `${house.chimney[1]}%`,
    "--window-x": `${house.light[0]}%`, "--window-y": `${house.light[1]}%`,
  } as CSSProperties}>
    <div className="recovery-house-sprite">
      <span className="house-ground-light" aria-hidden="true" />
      <img src={`/shop/houses/${house.id}.png`} alt={`${house.name}, a pixel-art recovery house for your heroes`} width="320" height="320" draggable="false" loading="lazy" decoding="async" />
      <span className="house-window-light" aria-hidden="true" />
      <span className="house-smoke" aria-hidden="true"><i/><i/><i/></span>
      <span className="house-motes" aria-hidden="true"><i/><i/><i/><i/></span>
    </div>
  </div>;
}
