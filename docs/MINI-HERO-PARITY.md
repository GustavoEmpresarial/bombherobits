# Mini Hero → Bomb Hero Bits: functional parity audit

Last checked: 2026-11-08. Reference: [dg.minihero.org](https://dg.minihero.org/). This is a working inventory, **not** a claim that the games are identical. HeroBits keeps its own pixel art, names, currency and design. No third-party assets or source code belong in this repository.

## What could be checked

The reference site's public screens and authenticated test account were inspected on 2026-11-08 through the connected browser. The observed account had 15 heroes, a Team roster and detail panel, separate weapon durability and hero shield, three gear slots, an Armory, Hall of Heroes, Market, Stake, Dungeon and Shop. Inspection was read-only: no purchase, retirement, staking, withdrawal or wallet transaction was submitted. This verifies visible behavior, not every backend rule or the art/assets.

The authenticated Gear Shop has Basic (10,000), Green (20,000) and Blue (35,000) boxes. Only Basic fills its Rare/Epic/Legendary bars (15/50/150); the box that fills a bar yields exactly that rarity. Quantities are 1/5/10/15; balance and chest are separate payment sources. Basic odds are 60/25/10/3.5/1.2/0.3 percent from Common through Mythic. HeroBits now matches these visible box rules and keeps purchase, rolls and pity in one idempotent transaction. Its original art and internal balance remain distinct.

## Feature matrix

| Area | HeroBits implementation | Remaining parity work / verification |
| --- | --- | --- |
| Lobby and navigation | Lobby, dedicated Team and Gear Shop pages, dungeon, summon, recovery houses, porter, market, ranking, invites, mail, settings, chest and withdrawal pages. Demo uses the same pages and API as the gated game. | Reference shortcuts also include Hall, Workshop and active Stake. HeroBits intentionally uses its own layout and art. |
| Dungeon | Server-authoritative movement, obstacles, chests, waves, attack effects, monsters, boss, stamina and shield depletion; live WebSocket updates. | Compare authenticated combat timing, target priorities, boss rules, reward caps and all edge cases against a recorded reference run. |
| Heroes | Dedicated Team roster/detail with work/rest, bulk work/rest, durability and shield bars, stats, skills and armory link. Repair and upgrade with Scrap, active party and equipment are present. | Reference has additional ATK SPD, crit, AOE and range rules, recovery ETA, shield formulas and richer detail. HeroBits stamina is displayed as weapon durability in Team but the underlying recovery rules differ. |
| Equipment | Three persistent gear slots per hero; dedicated shop for Basic/Green/Blue boxes, reference prices and visible odds; batch purchase 1/5/10/15 from game balance or chest; exact 15/50/150 Basic-only guarantees. Inventory cap, shield wear/repair, salvage, four-piece fusion and a gear market are implemented. Debits, rolls and guarantee counters share one transaction and idempotency key. | Wallet settlement, automatic porter gear repair, detailed market filters and opening animations remain absent. Scrap yields and gear stats are still HeroBits balance choices. |
| Summon | Persistent packs, staged confirmation, individual or all-card reveal, explicit claim, idempotent payment, rarity odds and progressive 15/50/100 rarity guarantees. Guarantee counters survive reloads and are backfilled from old batches. | Reference bars are called Uncommon/Rare/Epic; HeroBits uses its six established rarities and maps them to Rare/Super Rare/Epic. Reference pricing/payment uses MHDG and wallet operations; HeroBits uses test balance. Compare higher-rarity reset and display after real account access. |
| Recovery houses | Six tiers, one active house, slot capacity, enhanced stamina recovery and passive recovery outside it. A player can pin a resting hero to a slot or remove them from automatic allocation. Free slots still fill automatically. | Compare assignment ordering, prices and limited supply with the authenticated reference. |
| Porter | One purchased porter can be toggled. While the dungeon WebSocket is active, it sends resting heroes back to the arena at 80% stamina and replaces weaker workers when all slots are occupied. Rarity then attack determines priority for arena return, recovery slots and automatic repairs. Manual assignment is disabled while the porter is on. It can repair broken shields of selected rarities using Scrap. | Verify remaining return edge cases against an authenticated reference run. Reference price and global supply differ. |
| Fusion | Server-side fusion, rarity and ownership validation, history and UI. | Compare recipes, payment and result odds with the authenticated reference. |
| Market | List, cancel and buy eligible heroes, free equipment and services; ownership and demo/live separation enforced on the server. Listed equipment is unavailable for equip, repair, salvage or fusion until sale/cancellation. | Authenticated reference has Heroes, Blacksmiths, Porters, Gear, Sales and My Listings (0/20) tabs, rarity/price filters and gear compatibility detail. These filters, listing cap and wallet payment are absent locally. |
| Ranking | Seven-day summon board with weighted rarities and demo separation. | Reference Hall of Heroes has a 14-day season, 2X Glory event, Glory Road milestones, first-to-reach prizes and permanent hero retirement. None of those actions exist locally yet. |
| Chest / withdraw | Claimable rewards and in-game chest transfer/withdraw UI. | Token contract, wallet settlement, daily caps and chain confirmations remain unimplemented. The game should not imply a real payout until these exist. |
| Invites | Referral links, single redemption and demo/live separation. | Compare authenticated reward schedule and anti-abuse rules. |
| Mail | Persistent player mail and idempotent reward claims. | Compare authenticated templates, notifications and historical messages. |
| Settings | Sound, music and visual controls. | Check exact persistence and fullscreen behavior across browsers. |
| Stake and other reference offers | Stake has a “Coming soon” screen with no transaction controls. No Riftborn/step-up/raid equivalents. | Authenticated Stake is active, with Farm Bonus, Mint Cards and Scrap goals, independent 15-day stakes and a 50% day-one exit fee. The reference Shop also has Deals, Workshop and Riftborn. These are substantial remaining gaps; real payment/staking and settlement rules have not been reproduced. |
| Access | Public whitelist and creator applications, private game gate, full `/demo` flow. | Keep real-game access closed until launch configuration and approved wallets permit it. |

## Verified local behavior

- Pity thresholds are 15, 50 and 100 summons. A natural roll of the matching rarity resets its own bar. Legend and Super Legend also reset Epic. If thresholds coincide, the higher tier takes priority and the lower one stays ready for the next summon.
- Pity advancement, purchase debit and saved card rolls are in one transaction. Repeating a request key does not charge or advance twice.
- Porter automation runs only for an active dungeon session. It requires an owned, enabled porter, 80% stamina and a non-broken shield; it never places a hero in a wall, pillar, chest or occupied cell.
- With automatic shield repair enabled, the porter consumes Scrap only for a fully broken resting hero of an enabled rarity. It processes stronger heroes first, keeps the debit and shield restoration in one database transaction, and never charges again for an already repaired shield. The switch and rarity choices persist across reloads.
- The bulk `WORK >50%` action deploys only heroes whose current energy strictly exceeds half of their maximum. The ordinary `WORK ALL` mode still deploys eligible heroes with any positive energy; the browser remembers the selected mode.
- House recovery slots prioritize manually pinned heroes; manually excluded heroes recover outside at the base rate. With Porter enabled, the strongest resting heroes receive the boost. The selection recomputes when a hero fills their energy.
- QA database on port 5434 is separate from the user's other local database. Integration tests must use `HEROBITS_TEST_DATABASE=1` and a disposable `DATABASE_URL`.
- Equipment purchases reject a full armory before debiting game gold; repeated request keys return the original result. Equipping requires an idle hero and an unbroken piece; the 3-slot database constraint prevents duplicate slot occupancy. Dungeon hits drain equipped gear shields, and intact gear raises attack. Fusion consumes four free same-rarity pieces; matching elements carry through.
- Gear rarity weights total 10,000 on the lowest box; higher boxes exclude lower tiers and do not advance pity. The 15/50/150 guarantees persist per player; a due bar produces exactly its rarity. A repeated batch request key neither charges nor advances a counter. Gear listings transfer an intact ownership record with its remaining shield and settle only once.
- Docker Chromium completed a local QA browser flow on `/demo/armory` and `/demo/market`: three boxes rendered, one purchase created a piece and advanced the three guarantee bars, and the bought piece could be listed in the gear market. No browser errors were recorded. This uses a disposable QA database and does not prove reference parity.
- The authenticated comparison drove the new `/demo/heroes` Team page and `/demo/shop/gear` route. QA Chromium verified 18 roster heroes, work-all deployment of 15, rest-all returning to zero, durability/shield detail, three gear boxes, odds and no browser errors. The box purchase integration suite verified x5 and chest payment, including retry idempotency.
- Browser smoke sweep loaded all 17 known `/demo` routes (lobby, dungeon, shop, summon, recovery houses, porter, Scrap shop, market, fusion, ranking, armory, mail, invites, chest, withdraw, settings and stake) without a route-level error. This confirms rendering and navigation, not every interaction on those screens.

## Reproduction and checks

```bash
pnpm install
pnpm db:generate
pnpm build

# Only against a disposable, migrated QA database:
HEROBITS_TEST_DATABASE=1 DATABASE_URL='<QA database URL>' \
  pnpm --filter @herobits/api test:integration
```

The authenticated UI is available for further read-only comparison. For each remaining screen, record entry point, actions, preconditions, balance changes, animations, reload persistence, failure states and network-visible results. Do not submit purchases or wallet transactions while auditing. Implement and test each gap before marking that row complete.
