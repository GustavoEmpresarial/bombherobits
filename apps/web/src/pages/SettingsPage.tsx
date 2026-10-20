import { useEffect, useState } from "react";
import { useAuth } from "../state/AuthContext";

const PREFERENCES_KEY = "herobits_preferences";
function savedPreferences(): { sound: boolean; music: number; effects: number } {
  try {
    const saved = JSON.parse(localStorage.getItem(PREFERENCES_KEY) ?? "{}");
    const volume = (value: unknown, fallback: number) => typeof value === "number" && Number.isFinite(value) ? Math.max(0, Math.min(100, value)) : fallback;
    return { sound: typeof saved?.sound === "boolean" ? saved.sound : true, music: volume(saved?.music, 70), effects: volume(saved?.effects, 80) };
  } catch { return { sound: true, music: 70, effects: 80 }; }
}

export function SettingsPage() {
  const { logout, user } = useAuth();
  const [saved] = useState(savedPreferences);
  const [sound, setSound] = useState(saved.sound);
  const [music, setMusic] = useState(saved.music);
  const [effects, setEffects] = useState(saved.effects);
  const [fullscreen, setFullscreen] = useState(Boolean(document.fullscreenElement));
  const [error, setError] = useState("");
  useEffect(() => {
    try { localStorage.setItem(PREFERENCES_KEY, JSON.stringify({ sound, music, effects })); }
    catch { setError("Could not save preferences in this browser."); }
  }, [sound, music, effects]);
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
        <label className="setting">
          <span>Music volume {music}</span>
          <input
            type="range"
            min={0}
            max={100}
            value={music}
            disabled={!sound}
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
