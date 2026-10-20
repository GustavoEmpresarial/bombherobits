import { useEffect, useState } from "react";
import { useAuth } from "../state/AuthContext";
import { AUDIO_PREFERENCES_CHANGED, readAudioPreferences, saveAudioPreferences } from "../lib/audio-preferences";

export function SettingsPage() {
  const { logout, user } = useAuth();
  const [saved] = useState(readAudioPreferences);
  const [sound, setSound] = useState(saved.sound);
  const [music, setMusic] = useState(saved.music);
  const [effects, setEffects] = useState(saved.effects);
  const [musicEnabled, setMusicEnabled] = useState(saved.musicEnabled);
  const [fullscreen, setFullscreen] = useState(Boolean(document.fullscreenElement));
  const [error, setError] = useState("");
  useEffect(() => {
    if (!saveAudioPreferences({ sound, music, effects, musicEnabled }))
      setError("Could not save preferences in this browser.");
  }, [sound, music, effects, musicEnabled]);
  useEffect(() => {
    const sync = () => {
      const current = readAudioPreferences();
      setSound(current.sound);
      setMusic(current.music);
      setEffects(current.effects);
      setMusicEnabled(current.musicEnabled);
    };
    window.addEventListener(AUDIO_PREFERENCES_CHANGED, sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener(AUDIO_PREFERENCES_CHANGED, sync);
      window.removeEventListener("storage", sync);
    };
  }, []);
  useEffect(() => {
    const update = () => setFullscreen(Boolean(document.fullscreenElement));
    document.addEventListener("fullscreenchange", update);
    return () => document.removeEventListener("fullscreenchange", update);
  }, []);

  return (
    <section className="page" aria-label="SETTINGS">
      <section className="page-panel summon-buy settings-list">
        <h2 className="page-panel-title">Settings</h2>
        <div className="setting">
          <span>Wallet</span>
          <strong>{user?.wallet}</strong>
        </div>
        <div className="setting">
          <span>Fullscreen</span>
          <button
            type="button"
            className="cta-alt"
            aria-pressed={fullscreen}
            onClick={() => {
              setError("");
              const action = document.fullscreenElement ? document.exitFullscreen() : document.documentElement.requestFullscreen();
              void action.catch(() => setError("Fullscreen is unavailable in this browser."));
            }}
          >
            {fullscreen ? "ON" : "OFF"}
          </button>
        </div>
        <div className="setting">
          <span>Sound</span>
          <button type="button" className="cta-alt" aria-pressed={sound} onClick={() => setSound((v) => !v)}>
            {sound ? "ON" : "OFF"}
          </button>
        </div>
        <div className="setting">
          <span>Music</span>
          <button type="button" className="cta-alt" aria-pressed={musicEnabled} onClick={() => setMusicEnabled((v) => !v)} disabled={!sound}>
            {musicEnabled ? "ON" : "OFF"}
          </button>
        </div>
        <label className="setting">
          <span>Music volume {music}</span>
          <input
            type="range"
            min={0}
            max={100}
            value={music}
            disabled={!sound || !musicEnabled}
            onChange={(e) => setMusic(Number(e.target.value))}
          />
        </label>
        <label className="setting">
          <span>Effects volume {effects}</span>
          <input
            type="range"
            min={0}
            max={100}
            value={effects}
            disabled={!sound}
            onChange={(e) => setEffects(Number(e.target.value))}
          />
        </label>
        {error && <p className="error-line" role="alert">{error}</p>}
        <button type="button" className="cta cta-main" onClick={logout}>
          LOG OUT
        </button>
      </section>
    </section>
  );
}
