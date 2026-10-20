# Creator Program and Bomb Miner launch verification

October 20, 2026.

- Frontend and API production builds pass.
- Eight automated tests pass for creator validation, persistence behavior, retry handling, abuse limits, database failure, admin script syntax, public marketing configuration, social requirements and closed-whitelist enforcement.
- One PostgreSQL integration test passes for private creator/whitelist lists, administrative session requirements, invalid decisions and persisted review statuses.
- Browser: creator required-field validation, invalid Solana address and successful submission tested. The browser submission was verified in PostgreSQL as PENDING and its disposable QA row removed.
- Browser: landing page, token Coming soon state, disabled contract copy, closed whitelist, mobile menu and 375px layout inspected.
- No email, box, Discord role, social post or token transaction is sent automatically.

Commands:

```sh
pnpm --filter @herobits/api exec tsx --test tests/creators.test.ts tests/marketing.test.ts
HEROBITS_TEST_DATABASE=1 pnpm --filter @herobits/api exec tsx --test tests/marketing-admin.integration.test.ts
pnpm --filter @herobits/api build
pnpm --filter @herobits/web build
```

The whitelist is currently closed intentionally: official X/Discord links have not been supplied. Following and joining are checked manually after the channels exist and applications are explicitly opened. BR/PH translations are marked as coming soon.
