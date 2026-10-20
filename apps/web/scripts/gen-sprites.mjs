import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { PNG } from "pngjs";

const OUT = join(dirname(fileURLToPath(import.meta.url)), "../public/sprites");
mkdirSync(OUT, { recursive: true });

const C = {
  ink: [26, 16, 12, 255],
  orange: [255, 154, 60, 255],
  orangeD: [216, 98, 26, 255],
  orangeL: [255, 210, 122, 255],
  cream: [244, 236, 214, 255],
  blue: [87, 185, 255, 255],
  blueD: [31, 111, 184, 255],
  blueL: [167, 220, 255, 255],
  green: [110, 224, 106, 255],
  greenD: [47, 138, 58, 255],
  greenL: [190, 245, 160, 255],
  brown: [138, 74, 58, 255],
  brownD: [74, 36, 24, 255],
  brownL: [196, 140, 90, 255],
  stone: [90, 100, 120, 255],
  stoneD: [42, 50, 66, 255],
  stoneL: [154, 164, 184, 255],
  floorA: [58, 68, 88, 255],
  floorB: [47, 56, 74, 255],
  grout: [26, 32, 48, 255],
  wall: [20, 24, 32, 255],
  wallL: [48, 56, 72, 255],
  gold: [255, 212, 71, 255],
  goldD: [184, 134, 15, 255],
  goldL: [255, 236, 160, 255],
  red: [201, 74, 74, 255],
  flame: [255, 170, 51, 255],
  flameC: [255, 242, 168, 255],
  vine: [61, 138, 74, 255],
  wood: [106, 74, 32, 255],
  woodD: [62, 40, 18, 255],
  white: [238, 241, 248, 255],
  shadow: [0, 0, 0, 90],
  purple: [120, 70, 180, 255],
  purpleD: [60, 30, 100, 255],
  cloth: [180, 40, 40, 255],
};

class Sheet {
  constructor(frames, fw, fh, scale = 2) {
    this.frames = frames;
    this.fw = fw;
    this.fh = fh;
    this.scale = scale;
    this.w = frames * fw * scale;
    this.h = fh * scale;
    this.data = Buffer.alloc(this.w * this.h * 4);
  }

  set(x, y, c) {
    if (!c || x < 0 || y < 0 || x >= this.w || y >= this.h) return;
    const i = (y * this.w + x) * 4;
    this.data[i] = c[0];
    this.data[i + 1] = c[1];
    this.data[i + 2] = c[2];
    this.data[i + 3] = c[3] ?? 255;
  }

  px(frame, x, y, c) {
    const s = this.scale;
    const ox = frame * this.fw * s + x * s;
    const oy = y * s;
    for (let dy = 0; dy < s; dy++) {
      for (let dx = 0; dx < s; dx++) this.set(ox + dx, oy + dy, c);
    }
  }

  rect(frame, x, y, w, h, c) {
    for (let yy = 0; yy < h; yy++) {
      for (let xx = 0; xx < w; xx++) this.px(frame, x + xx, y + yy, c);
    }
  }

  save(name) {
    const png = new PNG({ width: this.w, height: this.h });
    this.data.copy(png.data);
    writeFileSync(join(OUT, name), PNG.sync.write(png));
  }
}

function saveSingle(w, h, draw, name, scale = 2) {
  const s = new Sheet(1, w, h, scale);
  draw(s, 0);
  s.save(name);
  return s;
}

function outlineBlob(s, frame, cells, fill, edge) {
  const set = new Set(cells.map(([x, y]) => `${x},${y}`));
  for (const [x, y] of cells) {
    const border =
      !set.has(`${x - 1},${y}`) ||
      !set.has(`${x + 1},${y}`) ||
      !set.has(`${x},${y - 1}`) ||
      !set.has(`${x},${y + 1}`);
    s.px(frame, x, y, border ? edge : fill);
  }
}

function block() {
  const s = new Sheet(2, 16, 16, 2);
  for (let f = 0; f < 2; f++) {
    s.rect(f, 2, 3, 12, 11, C.stoneD);
    s.rect(f, 3, 4, 10, 9, C.stone);
    s.rect(f, 3, 4, 10, 1, C.stoneL);
    s.rect(f, 3, 8, 10, 1, C.stoneD);
    s.rect(f, 7, 4, 1, 4, C.grout);
    s.rect(f, 5, 9, 1, 4, C.grout);
    // crack
    s.px(f, 9, 6, C.stoneD);
    s.px(f, 10, 7, C.stoneD);
    s.px(f, 9, 8, C.ink);
    if (f === 1) {
      s.px(f, 8, 7, C.stoneD);
    }
  }
  s.save("block.png");
}

function floor(name, base, alt) {
  saveSingle(
    16,
    16,
    (s, f) => {
      s.rect(f, 0, 0, 16, 16, base);
      s.rect(f, 0, 0, 16, 1, C.grout);
      s.rect(f, 0, 0, 1, 16, C.grout);
      for (let y = 0; y < 16; y++) {
        for (let x = 0; x < 16; x++) {
          const n = (x * 13 + y * 7 + name.length * 3) % 17;
          if (n === 0) s.px(f, x, y, alt);
          if (n === 3) s.px(f, x, y, C.grout);
        }
      }
      // crack
      s.px(f, 6, 9, C.grout);
      s.px(f, 7, 10, C.grout);
      s.px(f, 8, 10, C.stoneD);
    },
    name,
    2,
  );
}

function wall() {
  saveSingle(
    16,
    16,
    (s, f) => {
      s.rect(f, 0, 0, 16, 16, C.wall);
      for (let x = 0; x < 16; x += 4) {
        s.rect(f, x, 2, 3, 5, C.wallL);
        s.rect(f, x + 2, 9, 3, 5, C.stoneD);
      }
      s.rect(f, 0, 15, 16, 1, C.ink);
      // banner
      s.rect(f, 7, 4, 2, 6, C.cloth);
      s.px(f, 7, 10, C.gold);
    },
    "wall.png",
    2,
  );
}

function torch() {
  const s = new Sheet(4, 16, 16, 2);
  for (let f = 0; f < 4; f++) {
    s.rect(f, 7, 8, 2, 6, C.woodD);
    s.rect(f, 6, 7, 4, 2, C.wood);
    const flicker = [
      [
        [7, 2],
        [8, 2],
        [6, 3],
        [7, 3],
        [8, 3],
        [9, 3],
        [7, 4],
        [8, 4],
        [8, 5],
      ],
      [
        [8, 1],
        [7, 2],
        [8, 2],
        [9, 2],
        [6, 3],
        [7, 3],
        [8, 3],
        [8, 4],
        [7, 5],
      ],
      [
        [7, 2],
        [8, 3],
        [6, 4],
        [7, 4],
        [8, 4],
        [9, 4],
        [7, 5],
        [8, 5],
      ],
      [
        [8, 2],
        [7, 3],
        [8, 3],
        [9, 3],
        [7, 4],
        [8, 4],
        [6, 5],
        [8, 5],
      ],
    ][f];
    for (const [x, y] of flicker) s.px(f, x, y, C.flame);
    s.px(f, 7, 3, C.flameC);
    s.px(f, 8, 3, C.flameC);
  }
  s.save("torch.png");
}

function vine() {
  saveSingle(
    16,
    16,
    (s, f) => {
      s.px(f, 7, 0, C.vine);
      s.px(f, 7, 1, C.vine);
      s.px(f, 6, 2, C.green);
      s.px(f, 7, 2, C.vine);
      s.px(f, 7, 3, C.vine);
      s.px(f, 8, 4, C.greenL);
      s.px(f, 7, 4, C.vine);
      s.px(f, 7, 5, C.vine);
      s.px(f, 6, 6, C.green);
      s.px(f, 7, 6, C.vine);
    },
    "vine.png",
    2,
  );
}

function coin() {
  saveSingle(
    16,
    16,
    (s, f) => {
      const cells = [];
      for (let y = 3; y <= 12; y++) {
        for (let x = 3; x <= 12; x++) {
          const dx = x - 7.5;
          const dy = y - 7.5;
          if (dx * dx + dy * dy <= 22) cells.push([x, y]);
        }
      }
      outlineBlob(s, f, cells, C.gold, C.ink);
      s.rect(f, 6, 5, 4, 6, C.goldL);
      s.px(f, 7, 6, C.goldD);
      s.px(f, 8, 7, C.goldD);
      s.px(f, 7, 8, C.goldD);
      s.px(f, 8, 9, C.goldD);
    },
    "coin.png",
    2,
  );
}

function pile() {
  saveSingle(
    16,
    16,
    (s, f) => {
      s.rect(f, 2, 11, 12, 3, C.goldD);
      s.rect(f, 3, 9, 10, 3, C.gold);
      s.rect(f, 5, 7, 6, 3, C.goldL);
      s.px(f, 6, 6, C.gold);
      s.px(f, 8, 6, C.cream);
      s.px(f, 7, 8, C.goldD);
      s.px(f, 4, 10, C.cream);
      s.px(f, 10, 10, C.goldL);
    },
    "pile.png",
    2,
  );
}

function card() {
  saveSingle(
    16,
    22,
    (s, f) => {
      s.rect(f, 2, 1, 12, 20, C.purpleD);
      s.rect(f, 3, 2, 10, 18, C.purple);
      s.rect(f, 3, 2, 10, 1, C.gold);
      s.rect(f, 3, 19, 10, 1, C.gold);
      s.rect(f, 3, 2, 1, 18, C.gold);
      s.rect(f, 12, 2, 1, 18, C.gold);
      // mini keep
      s.rect(f, 5, 8, 6, 6, C.stoneD);
      s.rect(f, 6, 9, 4, 4, C.stone);
      s.px(f, 7, 6, C.flame);
      s.px(f, 8, 6, C.flameC);
      s.rect(f, 7, 11, 2, 2, C.ink);
    },
    "card.png",
    2,
  );
}

function chest() {
  saveSingle(
    16,
    12,
    (s, f) => {
      s.rect(f, 2, 3, 12, 7, C.red);
      s.rect(f, 2, 2, 12, 3, C.orangeD);
      s.rect(f, 3, 1, 10, 2, C.gold);
      s.rect(f, 7, 4, 2, 4, C.gold);
      s.px(f, 7, 6, C.goldL);
      s.rect(f, 2, 6, 12, 1, C.goldD);
      s.px(f, 3, 8, C.ink);
      s.px(f, 12, 8, C.ink);
    },
    "chest.png",
    2,
  );
}

block();
floor("floor-a.png", C.floorA, C.stoneL);
floor("floor-b.png", C.floorB, C.stone);
wall();
torch();
vine();
coin();
pile();
card();
chest();

console.log("sprites written to", OUT);

// Character art is original and generated from the checked-in atlas.
await import("./build-characters.mjs");
