export const viewModules = {
  boss: () => import('../components/BossArenaView'),
  pvp: () => import('../components/PvPBotArenaView'),
  tournament: () => import('../components/TournamentBracketsView'),
  rules: () => import('../components/RulesAndStrategyView'),
  bots: () => import('../components/BotVaultView'),
  database: () => import('../components/DataExplorerView'),
  replay: () => import('../components/ReplayViewer'),
  chat: () => import('../components/WorldChatModal'),
  admin: () => import('../components/AdminDashboardView'),
  training: () => import('../components/AlgorithmTrainingView'),
  status: () => import('../components/SystemStatus'),
};

// Warm only the screen the user points to or focuses; don't download every tool at startup.
export function preloadView(tab) {
  return viewModules[tab]?.().catch(() => {});
}

// Download small screen chunks in idle slots after the first page is interactive.
// Avoid extra background downloads on constrained connections or hidden tabs.
export function scheduleViewWarmup(){
  if(navigator.connection?.saveData || /(^|-)2g$/.test(navigator.connection?.effectiveType || ''))return ()=>{};
  const queue=['pvp','boss','bots','tournament','status','database','rules','training','replay','chat'];
  let cancelled=false,handle=null;
  const idle=typeof window.requestIdleCallback==='function';
  const next=async()=>{handle=null;if(cancelled || document.hidden)return;
    await preloadView(queue.shift());if(!cancelled && queue.length)schedule();};
  const schedule=()=>{if(cancelled || handle!==null || document.hidden || !queue.length)return;
    handle=idle?window.requestIdleCallback(next,{timeout:1500}):setTimeout(next,250);};
  document.addEventListener('visibilitychange',schedule);schedule();
  return ()=>{cancelled=true;document.removeEventListener('visibilitychange',schedule);
    if(handle!==null)(idle?window.cancelIdleCallback(handle):clearTimeout(handle));};
}
