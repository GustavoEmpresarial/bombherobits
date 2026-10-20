import Phaser from "phaser";
import {
  KEEP,
  arenaTheme,
  cellBlocked,
  cellCenter,
  pathBetween,
  type DungeonSnapshot,
  type DungeonCombatEvent,
  type HeroDto,
  type TargetDto,
} from "@herobits/shared";

import { ARENA_RENDER_SCALE, LOOT_MATERIAL_FRAME, MATERIAL_REGIONS, paintArena, paintBarriers } from "./arena-materials";
import { projectArena, ARENA_VIEW_WIDTH, ARENA_VIEW_HEIGHT, ARENA_PIXEL_RATIO } from "./arena-projection";
import { lootDisplaySize, visualWalkWaypoints } from "./arena-layout";
import { selectDungeonSnapshot } from "./snapshot-order";
import { CombatEventCursor } from "./combat-events";

// Keep the existing admin scale baseline while using tightly cropped rendered assets.
const CRATE_SCALE = (KEEP.CELL / 32) * 1.2;

const CRATES = ["wooden-crate", "iron-crate", "gold-chest", "crystal-chest", "ancient-vault"] as const;
const SKINS = ["aurek", "vesper", "cinder"] as const;

type CrateKind = (typeof CRATES)[number];
type Skin = (typeof SKINS)[number];

function hash(id: string) {
  let h = 2166136261;
  for (let i = 0; i < id.length; i++) {
    h ^= id.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function crateKind(target: TargetDto): CrateKind {
  if(target.kind)return target.kind;
  const n = hash(target.id) % 100;
  if (target.type === "BLOCK") {
    if (n < 40) return "ancient-vault";
    if (n < 75) return "gold-chest";
    return "crystal-chest";
  }
  if (n < 50) return "wooden-crate";
  if (n < 80) return "iron-crate";
  if (n < 95) return "gold-chest";
  return "crystal-chest";
}

function skinOf(hero: HeroDto): Skin {
  if (hero.class === "MAGE") return "vesper";
  if (hero.class === "ROGUE") return "cinder";
  return "aurek";
}

export class DungeonScene extends Phaser.Scene {
  private ready = false;
  private keepImage?: Phaser.GameObjects.Image;
  private barrierImage?: Phaser.GameObjects.Image;
  private combatCursor = new CombatEventCursor();
  private reducedMotion = false;
  private pending: DungeonSnapshot | null = null;
  private heroes = new Map<
    string,
    {
      root: Phaser.GameObjects.Container;
      view: Phaser.GameObjects.Container;
      sprite: Phaser.GameObjects.Sprite;
      bar: Phaser.GameObjects.Graphics;
      x: number;
      y: number;
      attackUntil: number;
      facing: number;
    }
  >();
  private crates = new Map<
    string,
    {
      root: Phaser.GameObjects.Container;
      view: Phaser.GameObjects.Container;
      sprite: Phaser.GameObjects.Sprite;
      bar: Phaser.GameObjects.Graphics;
      kind: CrateKind;
      index: number;
    }
  >();
  private torches: { sprite: Phaser.GameObjects.Sprite; light: Phaser.GameObjects.Sprite; phase: number }[] =
    [];
  private crateIndex = 0;

  constructor() {
    super("DungeonScene");
  }

  preload() {
    this.load.image("arena-materials", "/dungeon/realistic/materials-atlas.png");
    for (const skin of SKINS) {
      for (const action of ["idle", "walk", "attack"]) this.load.image(`${skin}-${action}`, `/characters/${skin}-${action}.png`);
    }

  }

  create() {
    this.reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    this.cameras.main.setBackgroundColor("rgba(0,0,0,0)");
    this.cameras.main.setOrigin(0, 0).setZoom(ARENA_PIXEL_RATIO);
    this.bakeKeep(arenaTheme(1));
    this.placeTorches();
    for (const skin of SKINS) for (const action of ["idle", "walk", "attack"]) this.textures.get(`${skin}-${action}`).setFilter(Phaser.Textures.FilterMode.NEAREST);
    this.ready = true;
    if (this.pending) this.render(this.pending);
  }

  update(time: number) {
    const t = time / 1000;
    for (const torch of this.torches) {
      const pulse = this.reducedMotion ? 0 : Math.sin(t * 5 + torch.phase) * 0.055 + Math.sin(t * 11 + torch.phase) * 0.025;
      torch.light.setAlpha(0.4 + pulse);
    }
    if (!this.pending) return;
    for (const [id, actor] of this.heroes) {
      const hero = this.pending.heroes.find((h) => h.id === id);
      if (!hero || hero.dungeonX == null || hero.dungeonY == null) continue;
      const hx = hero.dungeonX;
      const hy = hero.dungeonY;
      const attacking = this.time.now < actor.attackUntil;
      const moving =
        Math.abs(actor.root.x - cellCenter(hx)) > 1 ||
        Math.abs(actor.root.y - cellCenter(hy)) > 1;
      const skin = skinOf(hero);
      const action = moving ? "walk" : attacking ? "attack" : "idle";
      const key = `${skin}-${action}`;
      const image = this.textures.get(key).getSourceImage() as HTMLImageElement;
      const count = Math.max(1, Math.floor(image.width / 32));
      const frame = Math.floor(t * (action === "idle" ? 6 : 8) + hash(id) % 5) % count;
      const row = skin === "cinder" ? [2, 1, 0, 3][actor.facing] : [0, 1, 0, 2][actor.facing];
      actor.sprite.setTexture(key, this.pixelFrame(key, frame, row));
      actor.sprite.setOrigin(0.5).setPosition(0, 0).setAngle(0).setScale(this.pending?.visual?.heroScale ?? 1);
      const position = projectArena(actor.root.x, actor.root.y);
      actor.view.setPosition(position.x, position.y).setScale(1).setDepth(position.y + 1);

    }
  }

  applySnapshot(snapshot: DungeonSnapshot) {
    const next = selectDungeonSnapshot(this.pending, snapshot);
    if (next === this.pending) return;
    this.pending = next;
    if (this.ready) this.render(next);
  }

  private source(key: string) {
    return this.textures.get(key).getSourceImage() as CanvasImageSource;
  }

  private materialFrame(index: number) {
    const key = "arena-materials", name = `material-${index}`;
    const texture = this.textures.get(key);
    if (!texture.has(name)) {
      const [x, y, width, height] = MATERIAL_REGIONS[index];
      texture.add(name, 0, x, y, width, height);
    }
    return name;
  }

  private pixelFrame(key: string, frame: number, row: number) {
    const texture = this.textures.get(key), name = `${frame}:${row}`;
    if (!texture.has(name)) texture.add(name, 0, frame * 32, row * 32, 32, 32);
    return name;
  }

  private bakeKeep(theme: ReturnType<typeof arenaTheme>) {
    const tex = this.textures.exists("keep")
      ? this.textures.get("keep") as Phaser.Textures.CanvasTexture
      : this.textures.createCanvas("keep", ARENA_VIEW_WIDTH * ARENA_RENDER_SCALE, ARENA_VIEW_HEIGHT * ARENA_RENDER_SCALE);
    if (!tex) return;
    paintArena(tex.getContext(), this.source("arena-materials") as HTMLImageElement, theme);
    tex.refresh();
    if (!this.keepImage) this.keepImage = this.add.image(0, 0, "keep").setOrigin(0, 0).setDepth(0).setDisplaySize(ARENA_VIEW_WIDTH, ARENA_VIEW_HEIGHT);
    const barriers = this.textures.exists("barriers")
      ? this.textures.get("barriers") as Phaser.Textures.CanvasTexture
      : this.textures.createCanvas("barriers", ARENA_VIEW_WIDTH * ARENA_RENDER_SCALE, ARENA_VIEW_HEIGHT * ARENA_RENDER_SCALE);
    if (barriers) {
      paintBarriers(barriers.getContext(), this.source("arena-materials") as HTMLImageElement);
      barriers.refresh();
      if (!this.barrierImage) this.barrierImage = this.add.image(0,0,"barriers").setOrigin(0,0).setDepth(450).setDisplaySize(ARENA_VIEW_WIDTH,ARENA_VIEW_HEIGHT);
    }
  }

  private placeTorches() {
    const texture = this.textures.createCanvas("arena-glow", 128, 128);
    if (texture) {
      const ctx = texture.getContext();
      const glow = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
      glow.addColorStop(0, "#fff0b8b0");
      glow.addColorStop(0.2, "#ffb54558");
      glow.addColorStop(0.55, "#ef77201c");
      glow.addColorStop(1, "#ef772000");
      ctx.fillStyle = glow; ctx.fillRect(0, 0, 128, 128); texture.refresh();
    }
    for (let col = 3; col < 40; col += 6) {
      for (const row of [0, 20]) {
        const position = projectArena(cellCenter(col), cellCenter(row));
        const x = position.x, y = position.y;
        const light = this.add.sprite(x, y, "arena-glow").setDisplaySize(65, 65).setDepth(500).setBlendMode(Phaser.BlendModes.ADD).setAlpha(0.45);
        const sprite = this.add.sprite(x, y - 2, "arena-materials", this.materialFrame(13)).setDisplaySize(16, 18).setDepth(499);
        if (col % 12 === 9) light.setTint(0x5edbff);
        this.torches.push({ sprite, light, phase: col * 0.8 + row });
      }
    }
  }

  private render(snapshot: DungeonSnapshot) {
    const hits = this.combatCursor.consume(snapshot);
    this.syncCrates(snapshot.targets, new Set(hits.filter((hit) => hit.destroyed).map((hit) => hit.targetId)));
    this.syncHeroes(snapshot.heroes.filter((h) => h.status === "HUNTING"));
    if(snapshot.visual?.effectsEnabled!==false)for (const hit of hits) this.playAttack(hit);
  }

  private syncCrates(targets: TargetDto[], breaking: Set<string>) {
    const seen = new Set<string>();
    for (const target of targets) {
      if (cellBlocked(target.x, target.y)) continue;
      seen.add(target.id);
      const kind = crateKind(target);
      let actor = this.crates.get(target.id);
      if (!actor) {
        const index = this.crateIndex++;
        const root = this.add.container(cellCenter(target.x), cellCenter(target.y));
        const position = projectArena(root.x, root.y);
        const view = this.add.container(position.x, position.y).setScale(position.scale).setDepth(position.y);
        const shadow = this.add.ellipse(0, 3, 12, 3, 0x020303, 0.65);
        const sprite = this.add.sprite(0, 0, "arena-materials", this.materialFrame(LOOT_MATERIAL_FRAME[kind]));
        sprite.setOrigin(0.5, 0.5).setDisplaySize(lootDisplaySize(), lootDisplaySize());
        const bar = this.add.graphics();
        const glowColor = kind === "crystal-chest" ? 0x43daf4 : kind === "ancient-vault" ? 0xab63f5 : kind === "gold-chest" ? 0xffb735 : 0x54351d;
        const aura = this.add.sprite(0, 2, "arena-glow").setDisplaySize(20, 18).setTint(glowColor).setAlpha(kind === "wooden-crate" || kind === "iron-crate" ? 0.08 : 0.24).setBlendMode(Phaser.BlendModes.ADD);
        view.add([shadow, aura, sprite, bar]);
        actor = { root, view, sprite, bar, kind, index };
        this.crates.set(target.id, actor);
      }
      const size = lootDisplaySize(this.pending?.visual?.crateScale ?? CRATE_SCALE);
      actor.sprite.setTexture("arena-materials", this.materialFrame(LOOT_MATERIAL_FRAME[kind])).setDisplaySize(size, size);
      // Crates stay anchored to their spawn tile for their entire lifetime.
      this.drawBar(actor.bar, target.hp / target.maxHp, target.hp < target.maxHp, -8);
    }
    for (const [id, actor] of this.crates) {
      if (seen.has(id)) continue;
      if (breaking.has(id)) this.time.delayedCall(125, () => { actor.root.destroy(); actor.view.destroy(); });
      else { actor.root.destroy(); actor.view.destroy(); }
      this.crates.delete(id);
    }
  }

  private syncHeroes(heroes: HeroDto[]) {
    const seen = new Set<string>();
    for (const hero of heroes) {
      if (hero.dungeonX == null || hero.dungeonY == null) continue;
      if (cellBlocked(hero.dungeonX, hero.dungeonY)) continue;
      seen.add(hero.id);
      const skin = skinOf(hero);
      let actor = this.heroes.get(hero.id);
      if (!actor) {
        const root = this.add.container(cellCenter(hero.dungeonX), cellCenter(hero.dungeonY));
        const position = projectArena(root.x, root.y);
        const view = this.add.container(position.x, position.y).setScale(position.scale).setDepth(position.y + 1);
        const shadow = this.add.ellipse(0, 6, 15, 5, 0x020303, 0.6);
        const sprite = this.add.sprite(0, 0, `${skin}-idle`, this.pixelFrame(`${skin}-idle`, 0, 0));
        sprite.setOrigin(0.5, 0.5).setScale(1);
        const bar = this.add.graphics();
        view.add([shadow, sprite, bar]);
        actor = { root, view, sprite, bar, x: hero.dungeonX, y: hero.dungeonY, attackUntil: 0, facing: 0 };
        this.heroes.set(hero.id, actor);
      }
      if (hero.dungeonX !== actor.x || hero.dungeonY !== actor.y) {
        const path = pathBetween(actor.x, actor.y, hero.dungeonX, hero.dungeonY);
        const step = path[0] ?? { x: hero.dungeonX, y: hero.dungeonY };
        const dx = step.x - actor.x;
        const dy = step.y - actor.y;
        actor.facing = Math.abs(dx) >= Math.abs(dy) ? (dx < 0 ? 1 : 2) : dy < 0 ? 3 : 0;
        actor.x = hero.dungeonX;
        actor.y = hero.dungeonY;
        this.walk(actor.root, hero.dungeonX, hero.dungeonY);
      }
      const ratio = hero.stamina / hero.maxStamina;
      this.drawBar(actor.bar, ratio, ratio < 1);
    }
    for (const [id, actor] of this.heroes) {
      if (seen.has(id)) continue;
      actor.root.destroy();
      actor.view.destroy();
      this.heroes.delete(id);
    }
  }

  private playAttack(hit: DungeonCombatEvent) {
    const actor = this.heroes.get(hit.heroId);
    const targetPosition = projectArena(cellCenter(hit.x), cellCenter(hit.y));
    const x = targetPosition.x;
    const y = targetPosition.y;
    const from = projectArena(actor?.root.x ?? cellCenter(hit.fromX), actor?.root.y ?? cellCenter(hit.fromY));
    const fromX = from.x;
    const fromY = from.y;
    const color = hit.heroClass === "MAGE" ? 0xc5a0ff : hit.heroClass === "ROGUE" ? 0xffaa68 : 0xffe09a;
    if (actor) {
      actor.attackUntil = this.time.now + 650;
      const dx = hit.x - hit.fromX;
      const dy = hit.y - hit.fromY;
      actor.facing = Math.abs(dx) >= Math.abs(dy) ? (dx < 0 ? 1 : 2) : dy < 0 ? 3 : 0;

    }
    if (this.reducedMotion) {
      this.hitImpact(hit, color);
      return;
    }
    const weapon = this.add.graphics().setDepth(1000);
    if (hit.heroClass === "MAGE") {
      weapon.fillStyle(color, 0.25).fillCircle(0, 0, 4);
      weapon.fillStyle(color, 1).fillCircle(0, 0, 2);
      weapon.fillStyle(0xfff6e5, 1).fillRect(-1, -1, 2, 2);
    } else if (hit.heroClass === "ROGUE") {
      weapon.fillStyle(color, 0.3).fillRect(-6, -1, 6, 2);
      weapon.fillStyle(0xffe5b0, 1).fillRect(-3, -0.5, 6, 1);
      weapon.fillStyle(color, 1).fillTriangle(2, -2, 5, 0, 2, 2);
    } else {
      weapon.lineStyle(2, color, 0.95).beginPath().arc(0, 0, 7, -1, 1).strokePath();
      weapon.lineStyle(1, 0xffffff, 0.9).beginPath().arc(0, 0, 5, -0.8, 0.8).strokePath();
    }
    weapon.setPosition(fromX, fromY - 2).setRotation(Math.atan2(y - fromY, x - fromX));
    this.tweens.add({ targets: weapon, x, y: y - 2, duration: 120, ease: "Quad.Out", onComplete: () => { weapon.destroy(); this.hitImpact(hit, color); } });
  }

  private hitImpact(hit: DungeonCombatEvent, color: number) {
    const targetPosition = projectArena(cellCenter(hit.x), cellCenter(hit.y));
    const x = targetPosition.x;
    const y = targetPosition.y;
    const crate = this.crates.get(hit.targetId);
    if (crate && !this.reducedMotion) {
      this.tweens.killTweensOf(crate.sprite);
      crate.sprite.setPosition(0, 0).setAlpha(1).setTintFill(0xfff1c5);
      // Show a hit through light alone, without shaking or moving the loot.
      this.tweens.add({ targets: crate.sprite, alpha: 0.65, yoyo: true, duration: 60, onComplete: () => { crate.sprite.setAlpha(1); crate.sprite.clearTint(); } });
    }
    const spark = this.add.graphics().setPosition(x, y - 2).setDepth(1002);
    spark.lineStyle(1.5, 0xfff4d5, 1);
    for (let i = 0; i < 4; i++) {
      const angle = i * Math.PI / 2 + Math.PI / 4;
      spark.lineBetween(Math.cos(angle) * 2, Math.sin(angle) * 2, Math.cos(angle) * 6, Math.sin(angle) * 6);
    }
    spark.fillStyle(color, 0.9).fillRect(-1.5, -1.5, 3, 3);
    this.tweens.add({ targets: spark, alpha: 0, scale: this.reducedMotion ? 1 : 1.6, duration: 230, onComplete: () => spark.destroy() });
    this.floatCombatText(x, y - 9, "-" + hit.damage, "#fff0cf");
    if (hit.destroyed) {
      this.crateExplosion(hit);
      this.floatCombatText(x + 5, y, "+" + hit.reward.toLocaleString("en-US", { maximumFractionDigits: 2 }), "#ffe29b");
    }
  }

  private crateExplosion(hit: DungeonCombatEvent) {
    const targetPosition = projectArena(cellCenter(hit.x), cellCenter(hit.y));
    const x = targetPosition.x;
    const y = targetPosition.y;
    const kind = hit.kind??crateKind({ id: hit.targetId, type: hit.targetType } as TargetDto);
    const color = kind === "wooden-crate" ? 0xcf9956 : kind === "iron-crate" ? 0x91acbf : kind === "crystal-chest" ? 0x86dff5 : 0xf6c15b;
    const flash = this.add.graphics().setPosition(x, y).setDepth(1001);
    flash.fillStyle(0xffe7a8, 0.7).fillCircle(0, 0, 4);
    flash.lineStyle(1.5, color, 0.9).strokeCircle(0, 0, 6);
    this.tweens.add({ targets: flash, scale: this.reducedMotion ? 1 : 2.2, alpha: 0, duration: 280, onComplete: () => flash.destroy() });
    if (this.reducedMotion) return;
    for (let i = 0; i < 12; i++) {
      const angle = i * Math.PI * 2 / 12;
      const distance = 9 + (i % 4) * 3;
      const piece = this.add.rectangle(x, y, i % 3 === 0 ? 3 : 2, i % 2 === 0 ? 2 : 1, i % 3 === 0 ? 0xffe3a0 : color).setDepth(1003);
      this.tweens.add({ targets: piece, x: x + Math.cos(angle) * distance, y: y + Math.sin(angle) * distance - 4, angle: i * 37, alpha: 0, duration: 300 + (i % 3) * 70, ease: "Cubic.Out", onComplete: () => piece.destroy() });
    }
    for (let i = 0; i < 3; i++) {
      const smoke = this.add.circle(x + (i - 1) * 4, y, 3, 0x6c7c83, 0.4).setDepth(999);
      this.tweens.add({ targets: smoke, y: y - 11, x: smoke.x + (i - 1) * 5, scale: 2, alpha: 0, duration: 480, onComplete: () => smoke.destroy() });
    }
  }

  private floatCombatText(x: number, y: number, value: string, color: string) {
    const label = this.add.text(x, y, value, { fontFamily: '"Pixelify Sans", monospace', fontSize: "7px", color, stroke: "#080f18", strokeThickness: 2 }).setOrigin(0.5).setDepth(1004);
    this.tweens.add({ targets: label, y: this.reducedMotion ? y : y - 14, alpha: 0, duration: 700, ease: "Quad.Out", onComplete: () => label.destroy() });
  }

  private walk(
    root: Phaser.GameObjects.Container,
    x: number,
    y: number,
  ) {
    this.tweens.killTweensOf(root);
    const waypoints = visualWalkWaypoints(root.x, root.y, x, y);
    if (!waypoints.length) {
      root.setPosition(cellCenter(x), cellCenter(y));
      return;
    }
    let previous = { x: root.x, y: root.y };
    const distances = waypoints.map(point => {
      const distance = Phaser.Math.Distance.Between(previous.x, previous.y, point.x, point.y);
      previous = point;
      return distance;
    });
    const total = distances.reduce((sum,distance)=>sum+distance,0);
    let delay = 0;
    for (let i=0;i<waypoints.length;i++) {
      const duration = total > 0 ? distances[i] / total * Math.min(800, waypoints.length * 420) : 0;
      this.tweens.add({ targets:root, x:waypoints[i].x, y:waypoints[i].y, duration, delay, ease:"Linear" });
      delay += duration;
    }
  }

  private drawBar(g: Phaser.GameObjects.Graphics, ratio: number, visible: boolean, barY = -14) {
    g.clear();
    if (!visible) return;
    const clamped = Math.max(0, Math.min(1, ratio));
    g.fillStyle(0x0b0e12, 0.9);
    g.fillRect(-6, barY, 12, 2);
    g.fillStyle(0xe8d24c, 1);
    g.fillRect(-6, barY, 12 * clamped, 2);
  }
}

function fitZoom(parent: HTMLElement) {
  const box = parent.getBoundingClientRect();
  const width = box.width || parent.clientWidth;
  const height = box.height || parent.clientHeight;
  if (width < 8 || height < 8) return 1;
  const fit = Math.min(width / ARENA_VIEW_WIDTH, height / ARENA_VIEW_HEIGHT);
  return fit;
}

function pinCanvas(game: Phaser.Game) {
  const canvas = game.canvas;
  canvas.style.margin = "0";
  canvas.style.position = "absolute";
  canvas.style.left = "50%";
  canvas.style.top = "50%";
  canvas.style.transform = "translate(-50%, -50%)";
}

export function createDungeonGame(parent: HTMLElement) {
  const game = new Phaser.Game({
    type: Phaser.CANVAS,
    parent,
    width: ARENA_VIEW_WIDTH * ARENA_PIXEL_RATIO,
    height: ARENA_VIEW_HEIGHT * ARENA_PIXEL_RATIO,
    transparent: true,
    zoom: fitZoom(parent) / ARENA_PIXEL_RATIO,
    scene: [DungeonScene],
    scale: {
      mode: Phaser.Scale.NONE,
      autoCenter: Phaser.Scale.NO_CENTER,
    },
    render: {
      pixelArt: false,
      antialias: true,
      roundPixels: false,
    },
  });

  const fit = () => {
    const zoom = fitZoom(parent) / ARENA_PIXEL_RATIO;
    if (game.scale.zoom !== zoom) game.scale.setZoom(zoom);
    game.scale.refresh();
    pinCanvas(game);
  };
  const onScale = () => pinCanvas(game);
  game.scale.on("resize", onScale);
  game.events.once("ready", fit);
  requestAnimationFrame(fit);
  window.addEventListener("resize", fit);
  const parentResize = new ResizeObserver(fit);
  parentResize.observe(parent);
  game.events.once("destroy", () => {
    parentResize.disconnect();
    window.removeEventListener("resize", fit);
    game.scale.off("resize", onScale);
  });
  return game;
}
