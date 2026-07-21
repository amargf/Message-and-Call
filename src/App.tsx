import { useState, useEffect } from 'react';
import { MessageCircle, Moon, Sun } from 'lucide-react';
import { AuthProvider, useAuth } from '@/context/AuthContext';
import { useTheme } from '@/hooks/useTheme';
import { useChats, useOnlineUsers } from '@/hooks/useChats';
import { supabase } from '@/lib/supabase';
import AuthPage from '@/components/AuthPage';
import Sidebar from '@/components/Sidebar';
import ChatView from '@/components/ChatView';
import NewChatModal from '@/components/NewChatModal';
import NewGroupModal from '@/components/NewGroupModal';
import ProfileModal from '@/components/ProfileModal';
import ChatInfoPanel from '@/components/ChatInfoPanel';
import type { ChatWithDetails } from '@/types';

function MessengerApp() {
  const { user, profile, loading } = useAuth();
  const { chats, activeChatId, setActiveChatId, refreshChats } = useChats();
  const onlineUsers = useOnlineUsers();
  const { theme, toggleTheme } = useTheme();

  const [newChatOpen, setNewChatOpen] = useState(false);
  const [newGroupOpen, setNewGroupOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [infoOpen, setInfoOpen] = useState(false);
  
  // Removed mobileView dependency to always display both columns side-by-side

  const activeChat: ChatWithDetails | null =
    chats.find((c) => c.id === activeChatId) || null;

  // Update last_seen periodically
  useEffect(() => {
    if (!user) return;
    const updatePresence = async () => {
      await supabase.from('profiles').update({ last_seen: new Date().toISOString() }).eq('id', user.id);
    };
    updatePresence();
    const interval = setInterval(updatePresence, 60000);
    return () => clearInterval(interval);
  }, [user]);

  const handleSelectChat = (chatId: string) => {
    setActiveChatId(chatId);
  };

  const handleChatCreated = (chatId: string) => {
    refreshChats();
    setActiveChatId(chatId);
  };

  const handleBack = () => {
    setActiveChatId(null);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-white dark:from-gray-900 dark:to-gray-800">
        <div className="flex flex-col items-center gap-4">
          <div className="w-16 h-16 rounded-full bg-messenger-blue flex items-center justify-center animate-pulse">
            <MessageCircle className="text-white" size={32} strokeWidth={2.5} />
          </div>
          <div className="w-8 h-8 border-2 border-messenger-blue border-t-transparent rounded-full animate-spin" />
        </div>
      </div>
    );
  }

  if (!user || !profile) {
    return <AuthPage />;
  }

  return (
    <div className="h-screen flex bg-chat-light dark:bg-chat-dark overflow-hidden">
      {/* Theme toggle (floating) */}
      <button
        onClick={toggleTheme}
        className="hidden fixed bottom-4 left-4 z-30 p-2.5 rounded-full bg-white dark:bg-gray-800 shadow-lg text-gray-600 dark:text-gray-300 hover:scale-110 transition-transform md:hidden"
        aria-label="Toggle theme"
      >
        {theme === 'light' ? <Moon size={18} /> : <Sun size={18} />}
      </button>

      {/* Sidebar - Always visible side-by-side */}
      <div className="flex w-[320px] sm:w-[360px] lg:w-[380px] shrink-0 border-r border-gray-200 dark:border-gray-700">
        <Sidebar
          chats={chats}
          activeChatId={activeChatId}
          onSelectChat={handleSelectChat}
          onNewChat={() => setNewChatOpen(true)}
          onNewGroup={() => setNewGroupOpen(true)}
          onProfile={() => setProfileOpen(true)}
          onlineUsers={onlineUsers}
        />
      </div>

      {/* Chat view - Always visible side-by-side */}
      <div className="flex flex-1 min-w-0">
        {activeChat ? (
          <ChatView
            chat={activeChat}
            onBack={handleBack}
            onShowInfo={() => setInfoOpen(true)}
            onlineUsers={onlineUsers}
          />
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-center px-8">
            <div className="w-24 h-24 rounded-full bg-white dark:bg-gray-700 flex items-center justify-center mb-5 shadow-sm">
              <MessageCircle className="text-messenger-blue" size={44} strokeWidth={2} />
            </div>
            <h2 className="text-2xl font-bold text-gray-700 dark:text-gray-200 mb-2">
              Your messages
            </h2>
            <p className="text-gray-500 dark:text-gray-400 max-w-sm">
              Select a conversation to start chatting, or start a new one with the compose button.
            </p>
          </div>
        )}
      </div>

      {/* Modals */}
      <NewChatModal
        open={newChatOpen}
        onClose={() => setNewChatOpen(false)}
        onChatCreated={handleChatCreated}
      />
      <NewGroupModal
        open={newGroupOpen}
        onClose={() => setNewGroupOpen(false)}
        onGroupCreated={handleChatCreated}
      />
      <ProfileModal open={profileOpen} onClose={() => setProfileOpen(false)} />
      <ChatInfoPanel
        chat={activeChat}
        open={infoOpen}
        onClose={() => setInfoOpen(false)}
        onChatDeleted={handleBack}
      />
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <MessengerApp />
    </AuthProvider>
  );
}
