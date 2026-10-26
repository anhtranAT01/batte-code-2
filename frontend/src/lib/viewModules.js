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
  viewModules[tab]?.().catch(() => {});
}
