import { useEffect, useRef, useState } from "react";
import { AUDIO_PREFERENCES_CHANGED, readAudioPreferences, saveAudioPreferences } from "../lib/audio-preferences";

/** The soundtrack lives at Layout level so route changes do not restart the loop. */
export function GameMusic() {
  const audioRef = useRef<HTMLAudioElement>(null);
  const unlockedRef = useRef(false);
  const [preferences, setPreferences] = useState(readAudioPreferences);
  const enabled = preferences.sound && preferences.musicEnabled && preferences.music > 0;

  useEffect(() => {
    const sync = () => setPreferences(readAudioPreferences());
    window.addEventListener(AUDIO_PREFERENCES_CHANGED, sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener(AUDIO_PREFERENCES_CHANGED, sync);
      window.removeEventListener("storage", sync);
    };
  }, []);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.volume = preferences.music / 100 * .55;
    if (enabled && unlockedRef.current) void audio.play().catch(() => {});
    else audio.pause();
  }, [enabled, preferences.music]);

  useEffect(() => {
    const unlock = () => {
      unlockedRef.current = true;
      const audio = audioRef.current;
      const current = readAudioPreferences();
      if (audio && current.sound && current.musicEnabled && current.music > 0) {
        void audio.play().catch(() => {});
      }
    };
    document.addEventListener("pointerdown", unlock, { once: true });
    document.addEventListener("keydown", unlock, { once: true });
    return () => {
      document.removeEventListener("pointerdown", unlock);
      document.removeEventListener("keydown", unlock);
    };
  }, []);

  return <>
    <audio ref={audioRef} src="/audio/lanterns-in-the-vault.ogg" loop preload="metadata" aria-hidden="true" />
    <button
      type="button"
      className={`top-btn music-btn${enabled ? " is-playing" : ""}`}
      aria-label={enabled ? "Mute game music" : "Play game music"}
      aria-pressed={enabled}
      title={enabled ? "Music on · click to mute" : "Music off · click to play"}
      onClick={() => {
        unlockedRef.current = true;
        const next = { ...preferences, sound: true, music: preferences.music || 70, musicEnabled: !enabled };
        if (saveAudioPreferences(next)) setPreferences(next);
      }}
    >
      <span aria-hidden="true">{enabled ? "♫" : "♪"}</span>
      {!enabled && <i aria-hidden="true" />}
    </button>
  </>;
}
