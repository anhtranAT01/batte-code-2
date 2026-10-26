import React, { useState, useEffect, useLayoutEffect, useRef, lazy, Suspense } from 'react';
import { io } from 'socket.io-client';
import Sidebar from './components/Sidebar';
import HeaderBar from './components/HeaderBar';
import LeaderboardView from './components/LeaderboardView';
import AuthModal from './components/AuthModal';
import { apiOrigin } from './lib/api';
import useTheme from './hooks/useTheme';
import OutboxPump from './components/OutboxPump';
import ViewBoundary from './components/ViewBoundary';
import { viewModules, preloadView } from './lib/viewModules';

// Load game, replay and admin tools when opened instead of delaying the first page.
const BossArenaView = lazy(viewModules.boss);
const PvPBotArenaView = lazy(viewModules.pvp);
const TournamentBracketsView = lazy(viewModules.tournament);
const RulesAndStrategyView = lazy(viewModules.rules);
const BotVaultView = lazy(viewModules.bots);
const DataExplorerView = lazy(viewModules.database);
const ReplayViewer = lazy(viewModules.replay);
const WorldChatModal = lazy(viewModules.chat);
const AdminDashboardView = lazy(viewModules.admin);
const AlgorithmTrainingView = lazy(viewModules.training);
const SystemStatus = lazy(viewModules.status);

export default function App() {
  const { theme, toggleTheme } = useTheme();
  const [activeTab, setActiveTab] = useState('leaderboard');
  const mainRef = useRef(null);
  useLayoutEffect(() => { if (mainRef.current) mainRef.current.scrollTop = 0; }, [activeTab]);
  const [previousTab, setPreviousTab] = useState('leaderboard');
  const [selectedReplay, setSelectedReplay] = useState(null);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [authModalMode, setAuthModalMode] = useState('login');
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [onlineCount, setOnlineCount] = useState(1);
  const [socket, setSocket] = useState(null);
  useEffect(()=>{if(new URLSearchParams(window.location.hash.slice(1)).has('reset_token')||new URLSearchParams(window.location.search).has('reset_token')){setIsAuthModalOpen(true);setAuthModalMode('recovery');}},[]);

  // Initialize Socket.io connection
  useEffect(() => {
    // In dev, if on port 5173, backend is on port 5000; otherwise relative
    const socketUrl = import.meta.env.VITE_API_URL
      ? apiOrigin
      : window.location.port === '5173'
        ? `http://${window.location.hostname}:5000`
        : window.location.origin;

    const newSocket = io(socketUrl, {
      transports: ['websocket', 'polling'],
      reconnectionAttempts: 10,
      reconnectionDelay: 2000,
    });

    newSocket.on('connect', () => {
      console.log('[App Socket.io] Connected successfully:', newSocket.id);
    });

    newSocket.on('online:count', (data) => {
      if (data && typeof data.count === 'number') {
        setOnlineCount(Math.max(1, data.count));
      }
    });

    setSocket(newSocket);

    return () => {
      newSocket.disconnect();
    };
  }, []);

  // Handle Tab Switch
  const handleSelectTab = (tabId) => {
    if (tabId === 'chat') {
      setIsChatOpen(true);
      return;
    }
    setPreviousTab(activeTab);
    setActiveTab(tabId);
  };

  // Open Replay
  const handleOpenReplay = (replayDataOrId) => {
    setSelectedReplay(replayDataOrId);
    setPreviousTab(activeTab);
    setActiveTab('replay');
  };

  const [challengedOpponent, setChallengedOpponent] = useState(null);

  // Challenge a player from Leaderboard
  const handleChallengePlayer = (player) => {
    setChallengedOpponent(player);
    setPreviousTab(activeTab);
    setActiveTab('pvp');
  };

  // Open Auth Modal
  const handleOpenAuthModal = (mode = 'login') => {
    setAuthModalMode(mode);
    setIsAuthModalOpen(true);
  };

  return (
    <div className="app-shell flex h-screen font-sans antialiased overflow-hidden selection:bg-indigo-500 selection:text-white">
      <OutboxPump />
      {/* Left Sidebar Menu */}
      <Sidebar
        activeTab={activeTab}
        setActiveTab={handleSelectTab}
        onlineCount={onlineCount}
        isCollapsed={isSidebarCollapsed}
        setIsCollapsed={setIsSidebarCollapsed}
        onPreloadTab={preloadView}
      />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 h-screen overflow-hidden">
        {/* Top Header Bar */}
        <HeaderBar
          activeTab={activeTab}
          onOpenAuthModal={handleOpenAuthModal}
          onNavigateTab={handleSelectTab}
        />

        {/* Dynamic Page Views Container */}
        <main ref={mainRef} className="app-main flex-1 overflow-y-auto px-4 sm:px-6 lg:px-8 py-6 scrollbar-thin">
          <div className="max-w-7xl mx-auto pb-12">
            <ViewBoundary key={activeTab}>
            <Suspense fallback={<div role="status" className="view-loading"><span className="loading-orbit animate-spin" aria-hidden="true" />Đang mở trang...</div>}>
            {activeTab === 'leaderboard' && (
              <LeaderboardView
                onSelectReplay={handleOpenReplay}
                onChallengePlayer={handleChallengePlayer}
                onExploreData={() => setActiveTab('database')}
                onNavigateTab={handleSelectTab}
              />
            )}
            {activeTab === 'status' && <SystemStatus theme={theme} onToggleTheme={toggleTheme} />}

            {activeTab === 'pvp' && (
              <PvPBotArenaView
                onSelectReplay={handleOpenReplay}
                preselectedOpponent={challengedOpponent}
                onOpenBots={() => setActiveTab('bots')}
              />
            )}

            {activeTab === 'boss' && (
              <BossArenaView onSelectReplay={handleOpenReplay} />
            )}

            {activeTab === 'tournament' && (
              <TournamentBracketsView onSelectReplay={handleOpenReplay} onNavigateStatus={() => setActiveTab('status')} />
            )}

            {activeTab === 'training' && (
              <AlgorithmTrainingView onGoToBots={() => setActiveTab('bots')} />
            )}

            {activeTab === 'rules' && (
              <RulesAndStrategyView onGoToTemplates={() => setActiveTab('bots')} />
            )}

            {activeTab === 'database' && (
              <DataExplorerView onSelectReplay={handleOpenReplay} />
            )}

            {activeTab === 'bots' && (
              <BotVaultView onNavigateStatus={() => setActiveTab('status')} />
            )}

            {activeTab === 'admin' && (
              <AdminDashboardView onSelectReplay={handleOpenReplay} />
            )}

            {activeTab === 'replay' && (
              <ReplayViewer
                initialReplay={selectedReplay}
                onBack={() => setActiveTab(previousTab || 'leaderboard')}
              />
            )}
            </Suspense>
            </ViewBoundary>
          </div>
        </main>
      </div>

      {/* Authentication Modal */}
      <AuthModal
        isOpen={isAuthModalOpen}
        initialMode={authModalMode}
        onClose={() => setIsAuthModalOpen(false)}
      />

      {/* Real-time World Chat Modal */}
      {isChatOpen && <Suspense fallback={null}>
        <WorldChatModal
          isOpen={isChatOpen}
          onClose={() => setIsChatOpen(false)}
          socket={socket}
          onlineCount={onlineCount}
          onLogin={()=>{setIsChatOpen(false);handleOpenAuthModal('login');}}
        />
      </Suspense>}
    </div>
  );
}
