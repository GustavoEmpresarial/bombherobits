# Bomb Hero Bits economy discussion

Bomb Hero Bits will use **one game token** for heroes, recovery services, special items and marketplace payments. This decision was confirmed on 16 October 2026. SOL remains the Solana network gas asset; a single game token does not eliminate network fees.

The economic reference is the live [Solana Bombers public configuration](https://www.solanabombers.fun/api/config), retrieved on 16 October 2026. The unmodified response is stored in [the reference snapshot](reference/solana-bombers-config-2026-10-16.json). It is research data, not imported by the runtime. Its treasury addresses and token mints belong to Solana Bombers and must never become Bomb Hero Bits payment destinations.

The reference implements a BOMBERS game token and an AGS special-item token. Copying its mechanics into a single-token game requires a denomination decision for AGS items. No exchange ratio or Bomb Hero Bits token price is implied below.

## Confirmed reference parameters

The values below are the configuration published by Solana Bombers on the retrieval date. The endpoint distinguishes confirmed historical parameters, studio changes, assumptions and conflicting historical evidence. Its presence verifies what the application publishes; it does not independently audit its treasury or server enforcement.

| Mechanic | Published Solana Bombers setting |
| --- | --- |
| Standard hero | 25,000 BOMBERS |
| Standard mint packs | 1 or 5 heroes |
| Rarities | Common, Rare, Super Rare, Epic, Legend, Super Legend |
| Mint probabilities | 82.87%, 10.36%, 5.18%, 1.04%, 0.51%, 0.04% |
| Working heroes | 15 maximum |
| Loaded roster | 50 maximum |
| Owned roster | 500 maximum; reference marks the historical evidence as conflicting |
| Maximum hero level | 5 |
| Energy | 50 energy per stamina point; one energy per bomb |
| Recovery outside a house | 0.5 energy per minute |
| Offline treasure hunt | Disabled |
| Claim minimum | 100,000 BOMBERS |
| Claim token fee | 3% |
| Wallet balance required to claim | At least 2,500 BOMBERS |
| Claim cooldown | 0 minutes; marked as an implementation assumption |
| Standard studio fee | 0.0005 SOL per paid purchase/action, in addition to network fees |
| Cashout studio fee | 0.0025 SOL, in addition to network fees |
| Marketplace tax | 28% of the sale price |
| Tradable hero rarities | Super Rare, Epic, Legend and Super Legend |
| Hero market floors | 190,950 / 402,000 / 603,000 / 1,172,500 BOMBERS for those four tradable rarities |
| Minimum house listing | 33.5% of mint cost |
| Listing cancellation delay | 5 minutes |
| Minimum hero age for listing | No age lock |
| Qualified referral | Referred player has purchased at least 15 heroes |
| Referral reward | 2 heroes; recipient/qualification handling must be checked before implementation |

### Recovery buildings

The reference allows five owned/active houses. Bomb Hero Bits currently calls recovery buildings blacksmiths; the visual theme can retain that name while the eventual recovery mechanics follow the reference.

| Reference house | Price in BOMBERS | Recovery slots | Energy per minute | Maximum supply |
| --- | ---: | ---: | ---: | ---: |
| Tiny House | 1,800,000 | 4 | 2 | 2,500 |
| Mini House | 6,000,000 | 6 | 5 | 1,250 |
| Luxury House | 13,500,000 | 8 | 8 | 750 |
| Penthouse | 24,000,000 | 10 | 11 | 250 |
| Villa | 37,500,000 | 12 | 14 | 200 |
| Super Villa | 54,000,000 | 14 | 17 | 50 |
| Studio | 6,000,000 | 5 | 4.5 | 70 |
| AGS Event Center | 13,500,000 | 7 | 7 | 10 |
| Club House | 1,800,000 | 3 | 3 | 25 |

### Special items that need a single-token denomination

The reference's Butler automates recovery. It is limited to 200 total and one per player. Its published base price is 5,000,000 AGS, increasing by 100,000 AGS per purchase. It rests heroes at 1% energy, returns them at 80%, and can fill free work slots with heroes at 25% energy.

The reference's Series 2 Studio Box has 150 total boxes, one hero per box, and 55% Legend / 45% Super Legend odds. The first box costs 1,300,000 AGS, with a 325,000 AGS step per sale, ending at 49,725,000 AGS for box 150. These are premium-box odds, not ordinary hero mint odds.

For Bomb Hero Bits, both products will be priced in the single game token. Their exact starting prices and increments remain to be agreed. Reusing AGS numbers as if one AGS equaled one Bomb Hero Bits token would be an unsupported conversion.

### Hunting rewards

The reference uses a 35 by 17 bomber map, block destruction, bombs with a three-second fuse, and energy expenditure per bomb. Its configured block reward units convert to 35.625, 81.25, 406.25 and 812.5 BOMBERS for wooden, metal, gold and diamond reward blocks respectively. The reward configuration is in microtokens: divide `blockRewardMicro` values by 1,000,000. Its block spawn weights include assumptions/studio adjustments, so block rewards alone cannot establish hourly earnings.

Bomb Hero Bits currently uses a 41 by 21 dungeon with direct attacks against destructible crates and chests. The internal target type names still include the legacy `SLIME` identifier to preserve existing game state. Matching bomb counts, blast range, abilities, fuse timing and per-bomb stamina consumption is a gameplay change, not a price-table change.

## Current Bomb Hero Bits behavior

The current code is a prototype economy. Wallet message signing authenticates the account. Standard summons debit the user's database gold, and reward transfers move database chest credit into database gold. Neither route shown here constructs, verifies or sends an SPL payment. The sign-in being on Solana mainnet does not make those balances on-chain tokens.

| Area | Current Bomb Hero Bits | Difference from reference |
| --- | --- | --- |
| Standard summon | 100 database gold | No verified on-chain token payment |
| Starting credit | 500 gold | Complimentary prototype balance |
| Rarities | Common / Rare / Super Rare / Epic / Legend / Super Legend | Six server rarities; existing Legendary records retain their internal key |
| Actual ordinary odds | 82.87 / 10.36 / 5.18 / 1.04 / 0.51 / 0.04 percent | Managed in the private administration panel |
| Max working | 15 | Already agrees |
| Recovery services | Six blacksmith tiers, one in service | Different pricing and concurrency |
| Porter | 600 gold | Different pricing and recovery thresholds |
| Claim minimum | 50 chest units | Different amount and denomination |
| Claim fee | 3% | Same percentage, but internal transfer only |
| Marketplace fee | 5% in code | UI still intentionally marked coming soon |
| Referral | One card to each participant immediately | No 15-purchased-hero qualification |
| Rewards | 50 / 125 / 250 / 375 / 500 internal units by chest model | Five models with 80 / 250 / 500 / 750 / 1,000 HP |

Purchases and rescue-card redemptions now create persistent sealed packs. Revealing shows the stored roll without adding owned heroes; the explicit send-to-account action delivers them atomically. Pending packs reserve roster capacity, survive reloads and cannot be rerolled. Purchase request IDs and per-pack delivery prevent duplicate debits and heroes on retries. Default rarity attack multipliers are 1 / 1.35 / 1.6 / 1.8 / 2.5 / 3.2, also editable by the administrator. Stamina capacity is independently rolled from the rarity ranges below; class and attack multipliers do not alter it.

Relevant implementation: `packages/shared/src/index.ts`, `apps/api/src/routes/summons.ts`, `apps/api/src/services/summon-batches.ts`, `apps/api/src/services/world.ts`, `apps/api/src/services/dungeon.ts`, and `apps/web/src/lib/api.ts`.

During the visual redesign, no server economy values were switched to reference numbers. The UI now describes the internal reward transfer honestly and ordinary summon odds come from the same runtime configuration the server uses. The owner subsequently selected five chest reward levels (50–500) and resistance levels (80–1,000); these values and other gameplay parameters are now editable in the private administration panel. The later summon-flow update added six database rarities and adopted the six ordinary reference probabilities listed above.

## Single token adaptation to agree

1. **Token identity and unit scale.** Choose the mint, symbol, decimals and raw-unit accounting. Keep the current `MHDG` placeholder until the actual asset is selected. Matching relative costs does not require copying a token's arbitrary unit scale or market valuation.
2. **Ordinary loop.** Six database rarities and ordinary odds are now implemented. Decide separately whether to adopt the remaining reference pack sizes, work/roster limits, energy and recovery rules.
3. **Premium loop.** Keep the Butler and Studio Box supply/behavior as reference mechanics; choose their prices and increments in the sole Bomb Hero Bits token. Do not introduce a second premium currency.
4. **Fees.** Decide whether to retain the reference's studio fees in SOL, or pay game studio fees in the single game token while leaving only network gas in SOL. This is separate from the 3% claim tax and 28% market tax.
5. **Reward funding.** Define treasury allocations and the reward budget before accepting paid gameplay. Published reference prices do not disclose funding adequacy or guarantee that the same rewards are sustainable for another token.
6. **Claims.** Implement a real treasury-to-player payout with a transaction signature, pending/confirmed/failed status and a retry-safe payout identifier. Only then label it a wallet cashout. Preserve the internal transfer as a distinct action if retained.

## Implementation sequence after the economics discussion

First freeze the selected parameters in a shared, versioned ruleset and add the remaining database migrations for energy, house supply, item series and payment records. The six-rarity migration is already implemented. Compute all token amounts in integer base units.

Next connect purchases to transaction verification of the correct mint, decimals, recipient, amount and confirmation, bound to the requesting player and a single purchase intent. A transaction signature must not be reused to credit another purchase. Supply reservation, debits and inventory delivery need atomic updates.

Extend the remaining reference abilities and recovery model alongside accounting tests, then reward accrual and treasury-backed payouts. Use unique payout IDs, atomic balance reservation, pending state and chain reconciliation to prevent duplicate cashouts. The current internal claim operation also needs concurrency protection before it is reused for a real token.

Finally expose itemized purchase/claim quotes, show network charges separately, and test successful, rejected, expired, retried and concurrent transactions in an isolated environment. Mainnet payments remain a separate rollout from the visual redesign.

No fixed APR, daily return or break-even period can be concluded from these rules. Such figures also require token prices, treasury funding, hero distribution, energy utilization, map density and actual play statistics.

## Stamina by rarity — implemented 16 October 2026

Verified against the public configuration again; the relevant source fields are saved in [the stamina snapshot](reference/solana-bombers-stamina-2026-10-16.json). The reference publishes integer stat ranges and 50 energy per stamina point. New HeroBits summons and starter heroes roll integer points uniformly, including both endpoints, and store their energy capacity.

| Rarity | Stamina points | Energy capacity |
| --- | ---: | ---: |
| Common | 1–3 | 50–150 |
| Rare | 3–6 | 150–300 |
| Super Rare | 6–9 | 300–450 |
| Epic | 9–12 | 450–600 |
| Legend | 12–15 | 600–750 |
| Super Legend | 15–18 | 750–900 |

The Stamina admin section edits the six minimum/maximum ranges and energy-per-point conversion. The class-capacity field was removed because capacity now depends on rarity. Existing owned heroes are converted once to the nearest 50-energy capacity within their rarity range, preserving remaining charge percentage rounded down and leaving attack/speed unchanged. Purchased packs retain their stored attributes even after config changes. Future admin capacity edits affect new heroes, while existing heroes and pending packs retain their capacities.

HeroBits keeps the owner-selected consumption of 4 energy/minute and passive recovery of 0.5 energy/minute; both are editable. It does not adopt the reference cost-per-bomb model because HeroBits uses direct attacks. Forge recovery retains its configured rates and slot rules.
