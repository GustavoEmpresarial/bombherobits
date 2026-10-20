# Recovery houses

The recovery shop at `/shop/blacksmiths` (and `/demo/shop/blacksmiths`) now presents six original animated houses. Tier IDs, prices, capacities, sequential purchases and the single active service all continue using the existing authoritative server services. Existing ownership remains valid.

The artwork is original raster pixel art generated with the built-in ImageGen tool, saved under `apps/web/public/shop/houses/`. Actual alpha transparency was verified on all six PNGs. CSS adds chimney smoke, a flickering window light and floating crystal particles without moving the buildings. Animation pauses outside the viewport and respects reduced motion.

Visual names: Ember Nook, Copper Haven, Moonwell Lodge, Sunforge Hall, Starfall Retreat, Aurora Sanctuary. Runtime tier capacity, recovery rate and prices come from the server catalog. The shop, navigation and porter now use recovery-house language. The porter still needs one active house.

## Generation prompt set

Each of the six files was generated separately, with transparent_background=true, using the following exact common prompt followed by the corresponding tier prompt:

> Use case: stylized-concept. Asset type: transparent PNG pixel-art building sprite for the existing Bomb Hero Bits fantasy game. Create ONE original adorable recovery house where tiny beetle-knight, moth-mage and fox-ranger heroes regain stamina. Cohesive original identity: dark navy stone, warm copper/amber roof shingles shaped like overlapping beetle wing plates, tiny gold scarab crest over doorway, cyan crystal energy lantern, amber cozy windows, small cutaway stone plinth with moss. Clean true hand-placed pixel art with visible square clusters, strong dark pixel outlines, limited palette, no gradients or blurry painterly/3D rendering. Like a premium 96x96 pixel RPG building enlarged nearest-neighbor. Three-quarter front view, whole freestanding house fully visible and centered with generous clear margin. Transparent background with actual alpha, no painted background, no card, no UI, no lettering, no characters, no smoke cloud, no exterior halo. Single still building; smoke and animated glows will be added in code. Chimney near upper left at approximately 34% horizontal / 28% vertical, unobstructed windows facing viewer. Keep house centered, bottom of stone plinth near 85% height.

- `ember-nook.png`: Tier 1: a tiny humble single-room cottage, rounded amber-copper beetle shell roof, one squat stone chimney, one round cyan window, wooden door. Charming and simple, modest scale.
- `copper-haven.png`: Tier 2: a larger cozy two-room cottage with two joined copper roof shells, one squat chimney, small covered porch, cyan lantern and a pair of round warm windows. Noticeably more substantial than tier one.
- `moonwell-lodge.png`: Tier 3: an elegant two-storey moth-inspired recovery lodge, dark blue moon-shaped dormer roof, copper trim, round cyan stained-glass window, tiny balcony, one chimney, a glowing cyan well embedded in its stone base.
- `sunforge-hall.png`: Tier 4: a sturdy beetle knight recovery hall, wide copper shell vaulted roof, two compact turrets, golden crest, large glowing arched doorway, warm windows and cyan energy lanterns, one squat chimney.
- `starfall-retreat.png`: Tier 5: a luxurious whimsical three-storey retreat, clustered navy and copper roofs, two charming small towers, purple crystal accents, lantern-lit balconies, elegant luminous windows, one chimney, ornate scarab crest and stepped stone plinth.
- `aurora-sanctuary.png`: Tier 6: the ultimate magnificent miniature recovery sanctuary, broad symmetric navy-stone manor with a tall luminous cyan crystal dome under a gold beetle-wing crown, copper side roofs, elegant paired towers, welcoming amber doorway, cyan lamps, golden scarab crest, one chimney. Fantastical but still a cute inhabitable house, not a castle fortress.

## Validation

Frontend production build passes. Browser checks confirmed six loaded PNGs, running smoke animations on visible houses, paused animations off screen, sequential unlocking, purchase of the first two tiers, switching the active house to Copper Haven (6 slots, 5 stamina/min), and persistence after reload. The recovery house services and balance updates use the existing backend.
