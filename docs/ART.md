# Bomb Hero Bits original character art

The public brand is **Bomb Hero Bits**, with the slogan **Tiny heroes. Big booms.** The original generation prompts below retain the working name HeroBits as a historical record.

The Forgotten Vault artwork, characters and service illustrations were created from scratch with the built-in imagegen tool on 16 October 2026. The previous inherited hero and monster PNG files and their procedural generator functions have been removed. Environment tiles, UI items and fonts are separate existing assets.

## Production files

- `apps/web/public/art/vault-keyart.png`: cinematic title-screen environment.
- `apps/web/public/art/source/characters-atlas.png`: original transparent four-column, eight-row character source, 887 by 1774 pixels.
- `apps/web/public/characters/`: original portraits and runtime animation sheets.
- `apps/web/public/art/source/services-atlas.png`: source atlas for the new summoning cards, forge and clockwork porter.
- `apps/web/public/shop/`: three compiled original service illustrations.
- `apps/web/src/lib/characters.ts`: character identities, class mapping and copy.
- `apps/web/scripts/build-characters.mjs`: deterministic atlas slicing and runtime sheet compilation.

Run `pnpm --filter @herobits/web sprites` to rebuild environment/UI utility sprites and compile the new characters. The new character icon is written last. The character compiler never reads the removed hero/monster files.

## Characters

Aurek is a cream and gold beetle knight with a teal cape and sunblade. Vesper is a violet moth mage with a hood, antennae and moonstaff. Cinder is a coral fox ranger with a crossbow. Their server class IDs remain WARRIOR, MAGE and ROGUE; this redesign does not require an inventory migration.

Destructible containers replace opponents: Wooden Crate, Iron Crate, Gold Chest, Crystal Chest and Ancient Vault. Existing target types remain internal gameplay IDs; container art is selected deterministically from target IDs. The initial creature set has been superseded and removed from runtime assets.

## Animation format

Each source character has four illustrated idle frames. The compiler produces 512 by 128 PNG sheets: sixteen 32-pixel frames per row and four rows. The four source frames repeat across the sixteen frame slots. Left-facing rows are horizontal mirrors; vertical movement uses the same front three-quarter view. Hero walk cycles add a one-pixel bob, and attacks add a short lunge. These are derived motion states, not separately drawn back-facing or attack illustrations. This distinction should guide any later animation polish.

Pixels are sampled with nearest-neighbor scaling and hard alpha into 32-pixel cells. Phaser reads the same assets as the React lobby, while the landing page uses the higher-resolution source portraits.

## Final generation prompts

Both prompts used built-in imagegen, with no external CLI or API key.

### Title art

Use case: stylized-concept. Asset type: original production game key art, a wide landscape image for the HeroBits browser game sign-in. Create exquisite hand-crafted 2D pixel art, 16-bit dark fantasy dungeon crawler, sharp pixel clusters and deliberate limited palette, not smooth digital painting. A tiny original heroic party faces a gigantic ancient sealed treasure vault in an underground cavern: a cream-and-gold horned beetle knight with teal cape and a radiant short blade, a hooded violet moth mage carrying a crescent staff, a coral-red foxlike ranger with a crossbow. These are unique original characters, no existing game IP. Heroes are in the right half, standing on a stone bridge, seen three-quarter from behind, facing an enormous circular cyan arcane door at right. Vault corridors, brick ruins, glowing cyan mushrooms, gold treasure piles and floating ember pixels. Large dark navy negative space in the left 45 percent for actual HTML text overlay. Dense atmospheric depth, exquisite material texture, cyan teal light vs warm gold, charcoal blue palette compatible #0c131d #142131 #72d9dd #f7bd61. Premium indie game title-screen atmosphere, cinematic and memorable. Absolutely no typography, letters, logos, UI, borders or watermarks. Wide composition 1536x1024 or wider.

### Character atlas

Use case: stylized-concept. Asset type: ONE production 2D game animation sprite atlas for HeroBits. Transparent alpha background. Exact rigid layout: 4 columns by 8 rows, 32 equal square cells total, total canvas 1024 wide by 2048 high, each cell 256x256. No separators, lines, labels, text, shadows outside the character or scenery. Each cell contains one small complete full-body creature, centered horizontally, feet on an identical baseline at 85% cell height, takes about 65% cell width and 70% cell height. Four columns are four very similar idle/breathing animation frames of the SAME creature per row, same scale, camera angle and identity, slight breathing and weapon motion. Every creature faces three-quarter front-right. Crisp truly pixelated 16-bit RPG sprites drawn at approximately 48x48 native pixels then enlarged nearest neighbor. Chunky readable silhouettes, 2-pixel dark navy outlines, beautiful controlled pixel clusters, high contrast and limited colors. ROW 1: original cream and golden horned beetle knight with teal cape, tiny shining sword, brave chunky plated silhouette. ROW 2: original purple moth mage with hood, two antennae, lavender wings and glowing crescent staff. ROW 3: original rusty coral-red fox ranger with navy leather hood, pointy ears, bushy tail and tiny crossbow. ROW 4: original cyan crystalline crab with angular gem shell and two claws. ROW 5: original pale-blue haunted candle skull with small cyan flame atop head and navy eye sockets. ROW 6: original squat moss-green mushroom golem with huge dark emerald cap and stone fists. ROW 7: original dark violet cave bat with golden eyes, little crescent forehead mark and spread purple wings. ROW 8: original chunky copper treasure scarab monster, armored bronze carapace with treasure-shaped segments, glowing amber mandibles. This is one cohesive atlas, consistent visual quality for every row and cell. DO NOT reuse existing branded game characters. No extra rows or columns. Preserve transparent negative space between cells. All characters must be fully contained inside their cells.

The tool returned 887 by 1774 rather than the requested dimensions. The compiler uses normalized row/column boundaries so actual source dimensions do not change runtime geometry.

### Service items

Use case: stylized-concept. Asset type: ONE transparent game service-item atlas, three equal columns in a single row, wide 3:1 composition. Original 16-bit pixel art matching a dark fantasy dungeon game called HeroBits. No text, no letters, no labels, no UI borders, no scenery. Each of three columns has exactly one fully visible item, centered with generous transparent margins and same baseline. LEFT column: three fanned ornate summoning cards with midnight navy enamel backs, gilded pixel borders, cyan crescent and scarab sigil on the foremost card, small violet arcane glow. NO character illustration on any card. CENTER column: a cozy miniature dark-iron blacksmith anvil and glowing warm-gold furnace, tiny hammer resting on the anvil, cyan crystal bellows, compact isometric composition, gold embers. RIGHT column: a friendly little original brass clockwork beetle porter with round teal glass eyes, six tiny articulated feet, rolled sleeping mat and small leather backpack, carrying a recovery lantern. These are distinct original in-game service assets. Precise sharp pixel clusters, deliberate dark navy outlines, strong readable silhouette, constrained charcoal blue/cyan/gold/violet palette, detailed but clearly pixelated, not a 3D render. Canvas 1536x512 or same 3:1 aspect. Three equally spaced non-overlapping objects, one per column, transparent alpha background.

## Treasure containers replace creatures

On 16 October 2026 the game direction changed from creature opponents to destructible treasure containers, following the user's correction. Prism Crab, Hollow Wisp, Mossback, Duskwing and Giltmaw are no longer compiled, referenced or shipped as character sprites. The original character atlas is retained as the source for its three hero rows; its obsolete creature rows are ignored.

The active containers are Wooden Crate, Iron Crate, Gold Chest, Crystal Chest and Ancient Vault. They are defined in `apps/web/src/lib/characters.ts`, compiled by `apps/web/scripts/build-crates.mjs`, and saved under `apps/web/public/loot/`. Every runtime sheet is 64 by 32 pixels: one intact 32-pixel frame and one damaged frame. The scene selects the damaged state when target HP is below maximum. Crates remain anchored to their spawn tile and do not cycle between intact and damaged as an idle animation. Confirmed hits flash the sprite without positional shaking; only destruction debris moves.

`apps/web/public/art/crate-hunt-preview.png` is a screenshot of the actual Phaser renderer using isolated sample data and the replacement container sprites. It replaces the obsolete creature screenshot in the landing page. Gameplay amounts, target HP and rewards retain their existing server rules; the legacy `SLIME` target identifier remains internal for compatibility.

### Container atlas generation prompt

Built-in imagegen, transparent background. Use case: stylized-concept. Asset type: ONE production treasure-container sprite atlas for HeroBits, an original 16-bit bomber treasure farming game. Transparent alpha background. Exact layout FIVE equal columns and TWO equal rows, 10 items total, each fully centered inside its own uniform cell with generous clear margins. Wide 5:2 overall composition. No grid lines, labels, text, numbers, characters, creatures, faces, eyes or limbs. Top row: five CLOSED destructible containers, seen from a consistent slightly elevated front three-quarter camera, simple chunky readable compact silhouettes on same baseline. Column 1 wooden packing crate with thick oak boards and a diagonal brace. Column 2 steel-reinforced dark iron supply crate with rivets. Column 3 gold-banded wooden treasure chest with amber lock. Column 4 dark steel treasure chest with cyan crystal fittings. Column 5 ornate ancient navy and gold vault chest with a violet jewel. Bottom row: the SAME five containers in identical order, scale, orientation and position, but damaged with visible cracks and a little subtle warm light escaping; lids remain CLOSED. Every item should fit within 65% of its cell dimensions, no sparks spilling into neighboring cells. Crisp deliberate hand-drawn pixel clusters, approximately 32x32 native-pixel style enlarged nearest neighbor, dark navy pixel outlines, limited gold/cyan/steel/oak/violet palette. Designed to be legible as tiny breakable obstacles on a top-down grid. Cohesive polished indie game production quality. Absolutely no mimic monsters or anthropomorphism. Requested wide canvas around 1500x600, rigid five columns two rows.

## Bomb Hero Bits logo

Created with the built-in imagegen tool, transparent background, on 16 October 2026. Final asset: `apps/web/public/brand/bomb-hero-bits-logo.png` (2172×724). Applied to the landing header, footer, lobby, loading screen and wallet selector through `BrandWordmark`.

Prompt: Use case: logo-brand. Create an original polished pixel fantasy game logo for Bomb Hero Bits. Transparent background, horizontal compact lockup approximately 3:1, cropped closely with modest clear margin. Left emblem: a round midnight navy bomb wearing a small adventurous knight helmet, bright cyan visor and golden lit fuse, clear bold readable silhouette. Right lettering exact text "BOMB HERO BITS", BOMB large on top in warm gold, HERO BITS below in ivory with cyan accents, squared chunky pixel-inspired typography with dark navy outlines and subtle dimensional bevels. Match premium retro dungeon treasure adventure, palette navy #0c131d, gold #f7bd61, cyan #72d9dd and cream. Strong legibility at small website header size. No background scenery, no extra words, no watermark, no copied existing brand marks. Actual transparent alpha.

## Fusion teaser

The lobby Fusion card is unavailable and marked COMING SOON. Its transparent illustration is `apps/web/public/shop/fusion-altar.png` (1254 × 1254), created with the built-in ImageGen tool. The generation prompt is preserved in `docs/fusion-art-prompt.txt`.
