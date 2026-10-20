# Full game demo and animated landing preview

`/demo` runs the existing game inside a `/demo` router basename. The lobby, heroes, dungeon (Phaser + live backend/WebSocket), summons, card reveals and claims, blacksmiths, porter, rewards, invites and settings use the same pages and services as the main game. Features already marked Coming soon retain that status.

POST `/demo/session` creates a distinct demo user with 18 original heroes across all six rarities, 100,000 test currency, 5,000 chest rewards and 15 cards. Its signed token expires after 24 hours and is stored separately from the real player token. Reloads preserve the demo account. Demo sessions never connect a real wallet. Marketplace and referral services reject crossing the demo/real user boundary. The public real-game whitelist gate remains closed.

The landing preview remains a lightweight deterministic animation of the original pixel heroes working in a loop. Only treasure replenishes; floor and pillars stay fixed.

The shared collision grid retains the full 41 × 21 map. Interior pillars occupy even cells from (2,2) through (38,18). A single continuous walkable cell separates pillars from all perimeter walls. Barrier artwork stays within its collision cell.

Validation (2026-10-20): all 76 unit tests pass, plus a database-backed full-demo integration test covering the real access gate, 18 seeded heroes, 60 chests, deploying 15 heroes, resting, forge/porter purchases, five-card reveal/claim retries, chest transfer, same-demo referrals and rejection of demo/live marketplace and referral crossings. Frontend and API production builds pass. Browser checks cover direct entry, navigation, working heroes, individual/reveal-all cards, collection growth to 23 and persistence across reload. The deployment smoke check confirms the public real-game gate remains closed.
