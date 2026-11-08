# Mini Hero → Bomb Hero Bits: functional parity audit

Last checked: 2026-11-08. Reference: [dg.minihero.org](https://dg.minihero.org/). This is a working inventory, **not** a claim that the games are identical. HeroBits keeps its own pixel art, names, currency and design. No third-party assets or source code belong in this repository.

## What could be checked

The reference site's public screens were inspected. On 2026-11-07 the user explicitly authorized a one-time test-account sign-in for read-only inspection. A local challenge signature authenticated successfully; the private key was never stored in the repository, sent to the site or used for a transaction. The authenticated account/state, Hall, ranking, offers, mail, withdrawals, raid history and stake response shapes were checked. This exposed 15 owned heroes and separate fields for stamina, shield, skill effects, pity, forge, porter and shield auto-repair. The reference browser UI itself is still disconnected, so visual and click-by-click parity of authenticated screens remains unverified.

On 2026-11-08 the reference shipped an updated public bundle and configuration. The newly exposed equipment flow includes helm/armor/boots slots, fire/storm/frost elements, five gear rarities, gear boxes, shield wear and repair, equipping/removing, salvage and four-piece fusion. The connected Chrome tab could be listed but not controlled in this session; the integrated reference tab showed only its wallet login. The new feature was inferred from public resources and therefore still needs authenticated click-by-click comparison, especially prices, probabilities and marketplace settlement.

## Feature matrix

| Area | HeroBits implementation | Remaining parity work / verification |
| --- | --- | --- |
| Lobby and navigation | Lobby, dungeon, heroes sidebar, summon, shop, fusion, blacksmiths/recovery houses, porter, market, ranking, invites, mail, settings, chest and withdrawal pages. Demo uses the same pages and API as the gated game. | Compare authenticated reference navigation and state transitions. HeroBits intentionally uses its own layout and art. |
| Dungeon | Server-authoritative movement, obstacles, chests, waves, attack effects, monsters, boss, stamina and shield depletion; live WebSocket updates. | Compare authenticated combat timing, target priorities, boss rules, reward caps and all edge cases against a recorded reference run. |
| Heroes | Work/rest, rarity and stats, life-like shield, repair and upgrade with Scrap, skill effects, active party, armory and equipment. Bulk work has all-energy and above-50%-energy modes, with a persisted local choice and server-side threshold. | Compare hero detail/actions and precise shield formula/costs in an authenticated account. Current UI is not a one-to-one copy. |
| Equipment | Three persistent gear slots per hero; five box tiers, three elements, rarity compatibility, inventory cap, resting-only changes, same-day transfer limit, shield wear during combat, Scrap repair, salvage and four-piece fusion. Three intact pieces of one element add 10% of each piece's attack. All actions run server-side with ownership checks; box purchases have idempotency keys. A new armory panel displays pieces and actions. | Exact reference prices, attack/shield rolls, box odds, pity, wallet settlement, automatic porter repair, gear trading and visual effects remain unverified or absent. Current prices and rolls are HeroBits game-balance choices, not reference values. |
| Summon | Persistent packs, staged confirmation, individual or all-card reveal, explicit claim, idempotent payment, rarity odds and progressive 15/50/100 rarity guarantees. Guarantee counters survive reloads and are backfilled from old batches. | Reference bars are called Uncommon/Rare/Epic; HeroBits uses its six established rarities and maps them to Rare/Super Rare/Epic. Reference pricing/payment uses MHDG and wallet operations; HeroBits uses test balance. Compare higher-rarity reset and display after real account access. |
| Recovery houses | Six tiers, one active house, slot capacity, enhanced stamina recovery and passive recovery outside it. A player can pin a resting hero to a slot or remove them from automatic allocation. Free slots still fill automatically. | Compare assignment ordering, prices and limited supply with the authenticated reference. |
| Porter | One purchased porter can be toggled. While the dungeon WebSocket is active, it sends resting heroes back to the arena at 80% stamina and replaces weaker workers when all slots are occupied. Rarity then attack determines priority for arena return, recovery slots and automatic repairs. Manual assignment is disabled while the porter is on. It can repair broken shields of selected rarities using Scrap. | Verify remaining return edge cases against an authenticated reference run. Reference price and global supply differ. |
| Fusion | Server-side fusion, rarity and ownership validation, history and UI. | Compare recipes, payment and result odds with the authenticated reference. |
| Market | List, cancel and buy eligible heroes/services; ownership and demo/live separation enforced on the server. | Compare authenticated filters, listings, wallet payment flow, cooldowns and settlement. No real token transaction is integrated. |
| Ranking | Seven-day summon board with weighted rarities and demo separation. | The reference also has a separate Hall of Heroes with a Glory road, seasonal race, prize claims and retirement payment flow. None of those actions exist locally yet. Compare scoring, rewards and season rollover. |
| Chest / withdraw | Claimable rewards and in-game chest transfer/withdraw UI. | Token contract, wallet settlement, daily caps and chain confirmations remain unimplemented. The game should not imply a real payout until these exist. |
| Invites | Referral links, single redemption and demo/live separation. | Compare authenticated reward schedule and anti-abuse rules. |
| Mail | Persistent player mail and idempotent reward claims. | Compare authenticated templates, notifications and historical messages. |
| Settings | Sound, music and visual controls. | Check exact persistence and fullscreen behavior across browsers. |
| Stake and other reference offers | Stake has an honest “Coming soon” screen with no transaction controls. No Riftborn/step-up/raid equivalents. | The authenticated state exposes offer and raid structures, but real payment/staking and settlement rules have not been reproduced. Decide which limited-time offers belong to HeroBits before implementing them. |
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

To finish the comparison, inspect the authenticated reference UI and record for each screen: entry point, available actions, preconditions, balance changes, animations, reload persistence, failure states and network-visible results. Do not submit real purchases or wallet transactions while auditing. Implement and test each gap before marking that row complete.
