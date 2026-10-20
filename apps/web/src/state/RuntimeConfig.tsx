import { createContext,useContext,useEffect,useState,type ReactNode } from "react";
import { DEFAULT_CONFIG,GAME,type RuntimeConfig } from "@herobits/shared";
const ConfigContext=createContext<RuntimeConfig>(DEFAULT_CONFIG);
export function RuntimeConfigProvider({children}:{children:ReactNode}){
 const [config,setConfig]=useState<RuntimeConfig>(DEFAULT_CONFIG);
 useEffect(()=>{let active=true;let pending=false;async function refresh(){if(pending)return;pending=true;try{const response=await fetch((import.meta.env.VITE_API_URL??"http://localhost:3001")+"/config",{cache:"no-store"});if(response.ok){const data=await response.json();if(active)setConfig(data.config);}}catch{}finally{pending=false;}}
 void refresh();const timer=window.setInterval(()=>{if(!document.hidden)void refresh();},15000);const focus=()=>void refresh();window.addEventListener("focus",focus);return()=>{active=false;window.clearInterval(timer);window.removeEventListener("focus",focus);};},[]);
 return <ConfigContext.Provider value={config}>{children}</ConfigContext.Provider>;
}
export function useRuntimeConfig(){const config=useContext(ConfigContext);return {config,GAME:{...GAME,...config.game,SUMMON_COST:config.heroes.summonCost,STARTING_GOLD:config.heroes.startingGold,STAMINA_RECOVERY_PER_MINUTE:config.stamina.recoveryPerMinute,STAMINA_USAGE_PER_MINUTE:config.stamina.usagePerMinute},ECONOMY:config.economy,RARITY_WEIGHTS:config.heroes.rarityWeights};}
