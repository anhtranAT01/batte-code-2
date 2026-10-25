import React, { useState, useEffect } from 'react';
import { io } from 'socket.io-client';
import Sidebar from './components/Sidebar';
import HeaderBar from './components/HeaderBar';
import LeaderboardView from './components/LeaderboardView';
import BossArenaView from './components/BossArenaView';
import PvPBotArenaView from './components/PvPBotArenaView';
import TournamentBracketsView from './components/TournamentBracketsView';
import RulesAndStrategyView from './components/RulesAndStrategyView';
import BotVaultView from './components/BotVaultView';
import DataExplorerView from './components/DataExplorerView';
import ReplayViewer from './components/ReplayViewer';
import WorldChatModal from './components/WorldChatModal';
import AuthModal from './components/AuthModal';
import AdminDashboardView from './components/AdminDashboardView';
import { apiOrigin } from './lib/api';
import useTheme from './hooks/useTheme';

export default function App() {
  const { theme, toggleTheme } = useTheme();
  const [activeTab, setActiveTab] = useState('leaderboard');
  const [previousTab, setPreviousTab] = useState('leaderboard');
  const [selectedReplay, setSelectedReplay] = useState(null);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [authModalMode, setAuthModalMode] = useState('login');
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [onlineCount, setOnlineCount] = useState(1);
  const [socket, setSocket] = useState(null);

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
      {/* Left Sidebar Menu */}
      <Sidebar
        activeTab={activeTab}
        setActiveTab={handleSelectTab}
        onlineCount={onlineCount}
      />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 h-screen overflow-hidden">
        {/* Top Header Bar */}
        <HeaderBar activeTab={activeTab} onOpenAuthModal={handleOpenAuthModal} theme={theme} onToggleTheme={toggleTheme} />

        {/* Dynamic Page Views Container */}
        <main className="app-main flex-1 overflow-y-auto px-4 sm:px-6 lg:px-8 py-6 scrollbar-thin">
          <div className="max-w-7xl mx-auto pb-12">
            {activeTab === 'leaderboard' && (
              <LeaderboardView
                onSelectReplay={handleOpenReplay}
                onChallengePlayer={handleChallengePlayer}
                onExploreData={() => setActiveTab('database')}
              />
            )}

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
              <TournamentBracketsView />
            )}

            {activeTab === 'rules' && (
              <RulesAndStrategyView onGoToTemplates={() => setActiveTab('bots')} />
            )}

            {activeTab === 'database' && (
              <DataExplorerView onSelectReplay={handleOpenReplay} />
            )}

            {activeTab === 'bots' && (
              <BotVaultView />
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
      <WorldChatModal
        isOpen={isChatOpen}
        onClose={() => setIsChatOpen(false)}
        socket={socket}
        onlineCount={onlineCount}
      />
    </div>
  );
}
