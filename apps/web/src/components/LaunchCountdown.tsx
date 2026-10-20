import {useRuntimeConfig} from "../state/RuntimeConfig";
import { useEffect, useState } from "react";

// Presentation countdown; authentication and gameplay remain available.

export function LaunchCountdown() {
  const {config}=useRuntimeConfig();const launchTimestamp=Date.parse(config.launch.date);
  const [now, setNow] = useState(Date.now);
  useEffect(() => {
    const update = () => setNow(Date.now());
    const interval = window.setInterval(update, 1000);
    document.addEventListener("visibilitychange", update);
    return () => {
      window.clearInterval(interval);
      document.removeEventListener("visibilitychange", update);
    };
  }, []);

  if(!config.launch.enabled)return null;
  const launchDate=new Date(config.launch.date).toLocaleDateString("en-US",{month:"long",day:"numeric",year:"numeric",timeZone:"America/Porto_Velho"});
  const seconds = Math.max(0, Math.ceil((launchTimestamp - now) / 1000));
  const launched = seconds === 0;
  const units = [
    [Math.floor(seconds / 86400), "DAYS"],
    [Math.floor(seconds / 3600) % 24, "HOURS"],
    [Math.floor(seconds / 60) % 60, "MINUTES"],
    [seconds % 60, "SECONDS"],
  ] as const;

  return <section className="launch-countdown" aria-label={`Official launch on ${launchDate}. Early access is available now.`}>
    <div className="launch-countdown-heading"><span className="launch-spark" aria-hidden="true">✦</span><span>{launched ? "THE VAULT IS OPEN" : "THE VAULT OPENS"}</span><time dateTime={config.launch.date}>{new Date(config.launch.date).toLocaleDateString("en-US",{month:"long",day:"numeric",timeZone:"America/Porto_Velho"}).toUpperCase()}</time></div>
    {!launched && <div className="launch-clock" role="timer" aria-live="off" aria-label="Time until the official launch">{units.map(([value, label], index) => <div className="launch-clock-unit" key={label}><strong>{String(value).padStart(2, "0")}</strong><span>{label}</span>{index < units.length - 1 && <i aria-hidden="true">:</i>}</div>)}</div>}
    <p><span className="network-dot" />{launched ? "Your adventure is ready. Step inside." : "Early access is open. Start playing now."}</p>
  </section>;
}
