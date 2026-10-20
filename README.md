# Bomb Hero Bits

Idle dungeon hunter inspired by MiniHero / Bomb Farm.

## Stack

- **API:** Node + Fastify + TypeScript + Prisma + PostgreSQL
- **Web:** React + Vite + Phaser 3
- **Shared:** game constants & DTO types (`packages/shared`)

## Quick start

```bash
# 1) local configuration and dependencies
cp .env.example .env
cp .env.example apps/api/.env
pnpm install
pnpm db:generate

# 2) database
pnpm db:up
pnpm db:migrate
pnpm db:seed

# 3) run api + web
pnpm dev
```

- Web: http://localhost:5173  
- API: http://localhost:3001  
- Demo: http://localhost:5173/demo — all current game systems, test heroes and a separate virtual balance
- Main-game authentication: Solana wallet signature, subject to the early-access gate. The public game remains closed until access is enabled and a wallet is approved.

## MVP features

- Wallet login on Solana mainnet (nonce + signature)
- Animated hero management in the dungeon sidebar; summons with persistent packs, card reveals and explicit delivery
- Dungeon run with server-authoritative ticks
- Deploy heroes to open treasure chests and earn in-game rewards
- Six original animated recovery houses, a porter and stamina recovery
- Live updates over WebSocket

## Launch

The launch date and countdown visibility are managed by the private administration panel. The countdown does not unlock the live game. Live wallet access requires both `BMINER_EARLY_ACCESS_OPEN=true` and an approved whitelist wallet. `/demo` is available separately with test-only accounts; demo trading and invitations cannot cross into the live economy. See [demo documentation](docs/DEMO-LOOP.md) and [deployment instructions](deploy/README.md).

## Stamina recovery

Working heroes spend 4 stamina per minute: one point per 15 seconds of work. Fractional work time persists across resting, reactivation and server restarts, so repeated toggling cannot reset the consumption clock. Capacity is rolled by rarity: Common 50–150, Rare 150–300, Super Rare 300–450, Epic 450–600, Legend 600–750, Super Legend 750–900 energy. Each integer stamina stat point gives 50 energy. At 4 energy/minute, a full 100-energy hero works for about 25 minutes. These values are editable in the private admin Stamina section.

Resting (`IDLE`) heroes recover automatically at 0.5 stamina per minute (1 point every 2 minutes), including time away from the game. The active blacksmith applies its shared `rate` per minute to its available `slots`; other resting heroes keep the base rate. As a hero fills up, its forge slot goes to the next resting hero. Hunting and market-listed heroes do not recover.

`REST` recalls a hero and starts gradual recovery; it no longer instantly refills stamina. Recovery uses a persisted server clock and integer fractional progress, so refreshes, rest clicks and multiple tabs cannot accelerate it. The arena streams updates, and the full collection refreshes every 2 seconds.

## Dungeon waves and combat feedback

A wave starts with 60 assorted crates by default (editable in the administration panel). Each enabled chest model appears when the wave capacity permits; remaining slots follow the configured spawn weights. A wave has a finite set of crates. Destroying a crate decreases the remaining count; an empty wave is replenished on the next tick, with a new wave number. The opened-crate total persists for the run. Wave number, remaining/total chests and opened count appear in the top bar beside the arena name; no empty-party card covers the map. Every new wave cycles through five arena palettes (vault, frost, ember, amethyst and emerald), including floors, masonry, banners and torch lighting. The palette is derived from the wave number, so reloads preserve it; reduced-motion preferences suppress the transition flash. Existing run totals start tracking at the wave migration.

Confirmed server hits include a sequence number, damage, position and destruction/reward information. The scene plays class-specific attack effects, impact sparks and destruction debris once per event. Entering a run skips previous combat, and offline history is not replayed as a burst.

## Administração reservada e configuração

O painel é servido pela API em uma rota aleatória `/_ops-…`, sem links no jogo. Exige um token de acesso e usuário/senha administrativos próprios, separados do login de carteira. Não existe rota `/admin`.

Na primeira instalação, execute `pnpm --filter @herobits/api admin:setup` na raiz. O comando gera a rota, token, usuário e senha e salva o acesso em `.admin-access.txt`, ignorado pelo Git e bloqueado no servidor Vite. Reinicie a API após a configuração. O arquivo contém a URL local com token no fragmento; o painel remove esse fragmento do endereço assim que carrega. Os segredos não entram no bundle do jogo.

O painel permite salvar cada seção separadamente: baús, arena/ondas, consumo e recuperação de stamina, atributos/classes, raridades/probabilidades, invocação e pacotes, ferreiros, limites/preços/taxas, convites, duração do login dos jogadores, escalas/efeitos visuais e lançamento. Configurações ficam no PostgreSQL, com revisão, validação de limites e histórico de alterações. Alterações simultâneas exigem recarregar a revisão para evitar sobrescrita.

| Modelo | Resistência inicial | Recompensa inicial |
| --- | ---: | ---: |
| Madeira | 80 | 50 |
| Ferro | 250 | 125 |
| Ouro | 500 | 250 |
| Cristal | 750 | 375 |
| Ancestral | 1.000 | 500 |

Cada ataque desconta o dano do herói da resistência; a quantidade de golpes é a resistência dividida pelo dano, arredondada para cima. Novos valores de baús valem para os próximos baús gerados; os existentes mantêm sua resistência/recompensa. A migração inicial atualiza os baús antigos proporcionalmente ao dano já sofrido. Ataque, velocidade, faixas de stamina por raridade e probabilidades de heróis valem para novas invocações; o alcance se aplica à classe em combate. O jogo consulta a configuração a cada 15 segundos; a API atualiza seu cache em até 1 segundo. Recuperação e caça aplicam as taxas vigentes ao intervalo processado.

Senhas usam scrypt com salt; tokens e sessões são armazenados como hashes. Sessões administrativas duram uma hora em cookie HttpOnly/SameSite Strict, com token exigido também nas APIs, bloqueio de origem externa e limite de tentativas de login. Em produção use HTTPS (cookie Secure).

Para renovar senha, token e rota, pare a API e execute `pnpm --filter @herobits/api admin:rotate`; depois reinicie. Havendo vários administradores, informe o usuário como argumento. O comando substitui o arquivo privado de acesso e revoga todas as sessões administrativas. Guarde esse arquivo em local privado. Credenciais de infraestrutura e regras estruturais do mapa permanecem no código/ambiente, fora das configurações de jogabilidade.

The one-time local update `pnpm --filter @herobits/api exec tsx scripts/apply-wave-capacity.ts` records the 60-chest setting in the admin audit and expands unfinished waves below this capacity. Stop the API before running it. Existing damage and opened counts are preserved; new spawns avoid occupied chest and hunter cells.

## Hero target selection

Each working hero searches reachable firing positions using breadth-first search. A clear shot from the current position takes priority; otherwise the hero walks toward the closest reachable attack position, accounting for class range, walls, chests and other hunters. An enclosed nearby chest does not trap the hero while another chest is reachable. Paths are recomputed every tick, including after a chest is destroyed or a teammate moves, without overlapping occupied cells. A fully blocked hero retries when the next tick opens a route.

### Compra e revelação de heróis

Compras com ouro e resgates de cartas criam pacotes pendentes, sem adicionar heróis à coleção. Use **Revelar todos** para abrir o painel de cartas com animação de virada e **Enviar para a conta** para receber os heróis. Fechar o painel ou recarregar a página preserva os pacotes e o resultado revelado. Compras e entregas têm proteção contra repetição e concorrência; pacotes pendentes reservam espaço no limite do elenco.

As seis raridades são Common, Rare, Super Rare, Epic, Legend e Super Legend. As probabilidades padrão são, respectivamente, 82,87%, 10,36%, 5,18%, 1,04%, 0,51% e 0,04%, editáveis na seção Heróis e invocação do painel admin. Heróis existentes mantêm seus atributos. O pagamento continua usando os saldos internos do protótipo.

A migração de stamina por raridade adapta os heróis existentes ao múltiplo de 50 mais próximo dentro da faixa da raridade, preservando o percentual de energia (arredondado para baixo), ataque, velocidade e frações de consumo/recuperação. Pacotes já comprados mantêm os atributos armazenados; alterações futuras no admin valem para novos heróis e pacotes. A capacidade é independente da classe e do multiplicador de ataque.
