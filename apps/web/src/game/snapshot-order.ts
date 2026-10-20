import type { DungeonSnapshot } from "@herobits/shared";

// HTTP actions and the live socket can finish out of order. Never roll the arena back.
export function selectDungeonSnapshot(current: DungeonSnapshot | null, incoming: DungeonSnapshot): DungeonSnapshot {
  if (!current) return incoming;
  const currentTime = Date.parse(current.lastTickAt), incomingTime = Date.parse(incoming.lastTickAt);
  if (current.runId === incoming.runId && (incoming.wave < current.wave || incoming.combatSequence < current.combatSequence)) return current;
  if (Number.isFinite(currentTime) && Number.isFinite(incomingTime) && incomingTime < currentTime) return current;
  return incoming;
}
