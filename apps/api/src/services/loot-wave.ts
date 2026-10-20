import { LOOT_KINDS, type LootKind, type RuntimeConfig } from "@herobits/shared";

// Include each enabled model when space permits, then fill by configured spawn weight.
export function rollWaveLoot(count: number, crates: RuntimeConfig['crates'], random = Math.random): LootKind[] {
  const enabled = LOOT_KINDS.filter(kind => crates[kind].weight > 0);
  if (!enabled.length || count <= 0) return [];
  const total = enabled.reduce((sum, kind) => sum + crates[kind].weight, 0);
  const kinds: LootKind[] = count >= enabled.length ? [...enabled] : [];
  while (kinds.length < count) {
    let roll = random() * total;
    const kind = enabled.find(kind => { roll -= crates[kind].weight; return roll < 0; }) ?? enabled[enabled.length - 1];
    kinds.push(kind);
  }
  for (let index = kinds.length - 1; index > 0; index--) {
    const other = Math.floor(random() * (index + 1));
    [kinds[index], kinds[other]] = [kinds[other], kinds[index]];
  }
  return kinds;
}
