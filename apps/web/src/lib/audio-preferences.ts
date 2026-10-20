export const AUDIO_PREFERENCES_KEY = "herobits_preferences";
export const AUDIO_PREFERENCES_CHANGED = "herobits:audio-preferences-changed";

export type AudioPreferences = {
  sound: boolean;
  music: number;
  effects: number;
  musicEnabled: boolean;
};

const defaults: AudioPreferences = { sound: true, music: 70, effects: 80, musicEnabled: true };
const volume = (value: unknown, fallback: number) =>
  typeof value === "number" && Number.isFinite(value) ? Math.max(0, Math.min(100, value)) : fallback;

export function readAudioPreferences(): AudioPreferences {
  try {
    const saved = JSON.parse(localStorage.getItem(AUDIO_PREFERENCES_KEY) ?? "{}");
    return {
      sound: typeof saved?.sound === "boolean" ? saved.sound : defaults.sound,
      music: volume(saved?.music, defaults.music),
      effects: volume(saved?.effects, defaults.effects),
      musicEnabled: typeof saved?.musicEnabled === "boolean" ? saved.musicEnabled : defaults.musicEnabled,
    };
  } catch {
    return { ...defaults };
  }
}

export function saveAudioPreferences(preferences: AudioPreferences): boolean {
  try {
    localStorage.setItem(AUDIO_PREFERENCES_KEY, JSON.stringify(preferences));
    window.dispatchEvent(new Event(AUDIO_PREFERENCES_CHANGED));
    return true;
  } catch {
    return false;
  }
}
