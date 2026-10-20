import { KEEP, arenaTheme, cellCenter, cellPixel, cellBlocked } from "@herobits/shared";
import { projectArena, ARENA_VIEW_WIDTH, ARENA_VIEW_HEIGHT } from "./arena-projection";

// The render atlas is independent from the authoritative 41×21 collision grid.
export const ARENA_RENDER_SCALE = 4;
// Tight regions account for the generated atlas's natural gutters.
export const MATERIAL_REGIONS = [
  [16,16,288,288], [327,16,291,288], [636,16,291,288], [948,16,291,288],
  [18,316,284,298], [331,316,282,298], [642,316,282,298], [956,316,282,298],
  [23,629,279,279], [332,631,280,277], [640,631,284,277], [945,629,296,279],
  [14,924,293,290], [324,912,294,330], [628,952,386,260], [1017,910,225,320],
] as const;
export const LOOT_MATERIAL_FRAME = {
  "wooden-crate": 8,
  "iron-crate": 9,
  "gold-chest": 10,
  "crystal-chest": 11,
  "ancient-vault": 12,
} as const;

export function paintArena(
  ctx: CanvasRenderingContext2D,
  atlas: HTMLImageElement,
  theme: ReturnType<typeof arenaTheme>,
) {
  const { CELL, WORLD_W, WORLD_H } = KEEP;
  const floor = document.createElement("canvas");
  floor.width = WORLD_W * ARENA_RENDER_SCALE;
  floor.height = WORLD_H * ARENA_RENDER_SCALE;
  const ground = floor.getContext("2d")!;
  ground.scale(ARENA_RENDER_SCALE, ARENA_RENDER_SCALE);
  ground.imageSmoothingEnabled = true;
  ground.imageSmoothingQuality = "high";
  const source = (frame: number) => MATERIAL_REGIONS[frame];
  for (let y = 0; y < KEEP.ROWS; y++) {
    for (let x = 0; x < KEEP.COLS; x++) {
      const variation = (x * 73 + y * 137 + x * y * 11) >>> 0;
      const [sx, sy, sw, sh] = source(variation % 4);
      ground.save();
      ground.translate(cellCenter(x), cellCenter(y));
      ground.rotate((variation % 4) * Math.PI / 2);
      ground.drawImage(atlas, sx, sy, sw, sh, -CELL / 2, -CELL / 2, CELL, CELL);
      ground.restore();
    }
  }
  // Darken only the ground layer; raised stone, loot and heroes keep their contrast.
  ground.fillStyle = "rgba(4, 7, 11, 0.50)";
  ground.fillRect(16, 16, WORLD_W - 32, WORLD_H - 32);
  // Warm stone under neutral illumination; avoid gray theme washes over the material.
  const shade = ground.createLinearGradient(0, 0, WORLD_W, WORLD_H);
  shade.addColorStop(0, "#de9a3c18");
  shade.addColorStop(0.65, "#00000000");
  shade.addColorStop(1, "#03050828");
  ground.fillStyle = shade;
  ground.fillRect(16, 16, WORLD_W - 32, WORLD_H - 32);

  ctx.save();
  ctx.setTransform(ARENA_RENDER_SCALE, 0, 0, ARENA_RENDER_SCALE, 0, 0);
  ctx.clearRect(0, 0, ARENA_VIEW_WIDTH, ARENA_VIEW_HEIGHT);
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(floor, 0, 0, WORLD_W, WORLD_H);
  const draw = (frame: number, x: number, y: number, w: number = CELL, h: number = w) => {
    const [sx, sy, sw, sh] = source(frame);
    const p = projectArena(x + w / 2, y + h * 0.83);
    ctx.save();
    // The perimeter is dark iron/bronze, without the atlas's pale stone rim.
    if (frame >= 14) ctx.filter = "brightness(0.52) sepia(0.45) saturate(0.85)";
    else if (frame >= 4 && frame <= 7) ctx.filter = "brightness(1.30) contrast(1.06)";
    ctx.drawImage(atlas, sx, sy, sw, sh, p.x - w * p.scale / 2, p.y - h * p.scale * 0.83, w * p.scale, h * p.scale);
    ctx.restore();
  };
  const pool = (x: number, y: number, radius: number, color: string) => {
    const p = projectArena(x, y);
    const gradient = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, radius);
    gradient.addColorStop(0, color); gradient.addColorStop(1, "transparent");
    ctx.fillStyle = gradient; ctx.fillRect(p.x - radius, p.y - radius, radius * 2, radius * 2);
  };

  // The lower rail has a dark bronze front face rather than a flat gray frame.
  const a = projectArena(16, 337), b = projectArena(672, 337);
  const fascia = ctx.createLinearGradient(0, a.y, 0, a.y + 17);
  fascia.addColorStop(0, "#5d4427"); fascia.addColorStop(0.18, "#2d241b"); fascia.addColorStop(1, "#080a0c");
  ctx.fillStyle = fascia;
  ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.lineTo(b.x - 1, b.y + 16); ctx.lineTo(a.x + 1, a.y + 16); ctx.closePath(); ctx.fill();
  ctx.strokeStyle = "#ad844350"; ctx.lineWidth = 0.8;
  ctx.beginPath(); ctx.moveTo(a.x, a.y + 4); ctx.lineTo(b.x, b.y + 4); ctx.stroke();

  // Back wall first; south-facing object silhouettes remain upright in perspective.
  for (let x = 0; x < 41; x++) draw(14, cellPixel(x), 12, CELL, 19);
  for (let y = 2; y < 20; y += 2) {
    for (let x = 2; x < 40; x += 2) {
      if (!cellBlocked(x, y)) continue;
      const px = cellPixel(x), py = cellPixel(y);
      const p = projectArena(px + 10, py + 15);
      ctx.fillStyle = "#02030370";
      ctx.beginPath(); ctx.ellipse(p.x + 2, p.y + 2, 10 * p.scale, 5 * p.scale, 0, 0, Math.PI * 2); ctx.fill();
    }
  }
  for (let y = 1; y < 20; y++) for (const x of [0, 40]) draw(15, cellPixel(x) + 2, cellPixel(y) - 4, 12, 21);
  for (let x = 0; x < 41; x++) draw(14, cellPixel(x), cellPixel(20) - 2, CELL, 19);
  for (const x of [0, 40]) for (const y of [0, 20]) draw(15, cellPixel(x) - 3, cellPixel(y) - 7, 23, 29);

  ctx.globalCompositeOperation = "screen";
  for (let x = 3; x < 40; x += 6) for (const y of [0, 20]) {
    pool(cellCenter(x), cellCenter(y), 44, x % 12 === 9 ? "#35c4df22" : "#ff992f3c");
  }
  ctx.globalCompositeOperation = "source-over";
  ctx.restore();
}


// Foreground barrier faces occlude actors and loot, keeping their art off the pillar tops.
export function paintBarriers(ctx: CanvasRenderingContext2D, atlas: HTMLImageElement) {
  ctx.save();
  ctx.setTransform(ARENA_RENDER_SCALE, 0, 0, ARENA_RENDER_SCALE, 0, 0);
  ctx.clearRect(0, 0, ARENA_VIEW_WIDTH, ARENA_VIEW_HEIGHT);
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.filter = "brightness(1.30) contrast(1.06)";
  for (let y=2;y<KEEP.ROWS-1;y+=2) for (let x=2;x<KEEP.COLS-1;x+=2) {
    if (!cellBlocked(x,y)) continue;
    const frame=(x*13+y*7)%17===0 ? 6+((x+y)%2) : 4+((x+y/2)%2);
    const [sx,sy,sw,sh]=MATERIAL_REGIONS[frame];
    ctx.drawImage(atlas,sx,sy,sw,sh,cellPixel(x),cellPixel(y),KEEP.CELL,KEEP.CELL);
  }
  ctx.restore();
}
