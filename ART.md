
### Rendered dungeon materials (October 16, 2026)

The playable arena uses the generated materials atlas below. The experimental rendered hero atlas is retained as an unused asset; original Bits character sprites have been restored:

- `apps/web/public/dungeon/realistic/materials-atlas.png` — 1254×1254 RGBA; stone floors, raised blocks, five treasure containers, brazier and perimeter masonry. Tight source regions are defined in `apps/web/src/game/arena-materials.ts`.
- `apps/web/public/dungeon/realistic/heroes-atlas.png` — 1448×1086 RGBA; four directions for Aurek, Vesper and Cinder. Retained for reference only; no longer loaded by the arena or sidebar.
- Generation prompts: `docs/realistic-arena-prompts.txt`.

Materials are baked at 4× resolution; the playable canvas renders at 3× resolution (2064px backing width). The map is again a straight top-down rectangle with no perspective taper or skew. Arena actors and sidebar portraits use the original pixel character sheets; their idle, walking and attack animations use nearest-neighbor sampling. Oversized actor/loot scales and the extra zoom controls have been reverted. Collision cells, treasure positions and combat state remain server authoritative.

Validation: web build and 47 logic tests passed. A real Phaser browser harness ran 20 impacts across all five loot materials, observing zero root or sprite displacement; it also verified hero movement and wave-theme repainting. Visual review used controlled snapshot data and did not alter player accounts.

### Stable arena identity

The arena keeps the Forgotten Vault appearance through every treasure wave. Automatic theme cycling, background repaints and full-screen transition flashes are disabled. HTTP and WebSocket updates share monotonic snapshot selection, also enforced by the Phaser scene, so stale wave/combat/tick responses cannot rewind targets or player balances. Browser verification applied ten waves and a stale third-wave response: zero background repaints, no flash, unchanged loot anchors and the same arena name.

### Corridor and barrier fit

Treasure containers default to a 12px square within 16px cells and are capped at 14px even with increased visual scale settings. Pillar faces render as a foreground occlusion layer, preventing character and loot artwork from covering their tops. Movement animation replans from its interpolated visible position and follows axis-aligned cell centers, so an interrupted animation cannot cut a diagonal across a blocked pillar. The server collision grid remains unchanged. Validation: 54 logic tests passed; the live Phaser regression sampled 104 frames with zero blocked-cell entries, a successful arrival, hidden invalid pillar occupants and barrier faces above the actors.
