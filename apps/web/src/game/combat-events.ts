import type { DungeonCombatEvent, DungeonSnapshot } from "@herobits/shared";

/** Play each confirmed hit once, without replaying old/offline combat on entry. */
export class CombatEventCursor {
  private runId: string | null = null;
  private sequence = 0;

  consume(snapshot: DungeonSnapshot): DungeonCombatEvent[] {
    if (this.runId !== snapshot.runId) {
      this.runId = snapshot.runId;
      this.sequence = snapshot.combatSequence;
      return [];
    }
    if (snapshot.combatSequence <= this.sequence) return [];
    const previous = this.sequence;
    this.sequence = snapshot.combatSequence;
    const now = Date.parse(snapshot.lastTickAt);
    return snapshot.combatEvents.filter((event) => {
      const age = now - Date.parse(event.at);
      return event.sequence > previous && event.sequence <= this.sequence && age >= 0 && age <= 2000;
    }).sort((a, b) => a.sequence - b.sequence).slice(-32);
  }
}
