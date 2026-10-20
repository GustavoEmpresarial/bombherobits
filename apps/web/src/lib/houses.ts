export const RECOVERY_HOUSES = [
  { id: "ember-nook", name: "Ember Nook", color: "#e6ab70", mood: "A little warmth goes a long way.", chimney: [34,12], light: [37,62] },
  { id: "copper-haven", name: "Copper Haven", color: "#7fc9b0", mood: "A cozy place for a growing party.", chimney: [37,15], light: [25,63] },
  { id: "moonwell-lodge", name: "Moonwell Lodge", color: "#78cbe5", mood: "Rest beneath the moth-lit moon.", chimney: [32,5], light: [63,35] },
  { id: "sunforge-hall", name: "Sunforge Hall", color: "#f2c467", mood: "A golden hearth for brave little hearts.", chimney: [31,16], light: [61,65] },
  { id: "starfall-retreat", name: "Starfall Retreat", color: "#c5a0ef", mood: "Dream a little bigger between adventures.", chimney: [32,15], light: [50,34] },
  { id: "aurora-sanctuary", name: "Aurora Sanctuary", color: "#83e4d2", mood: "The brightest home in the forgotten world.", chimney: [24,24], light: [53,29] },
] as const;
export const recoveryHouse = (tier: number) => RECOVERY_HOUSES[Math.max(0, Math.min(RECOVERY_HOUSES.length - 1, tier - 1))];
