import { useState } from 'react';
import { Search, Edit, Users, Moon, Sun, LogOut, Settings, MessageCircle, X } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { useTheme } from '@/hooks/useTheme';
import type { ChatWithDetails } from '@/types';
import {
  getChatDisplayName,
  formatTime,
  displayName,
} from '@/lib/utils';
import Avatar from '@/components/Avatar';

interface SidebarProps {
  chats: ChatWithDetails[];
  activeChatId: string | null;
  onSelectChat: (chatId: string) => void;
  onNewChat: () => void;
  onNewGroup: () => void;
  onProfile: () => void;
  onlineUsers: Set<string>;
}

export default function Sidebar({
  chats,
  activeChatId,
  onSelectChat,
  onNewChat,
  onNewGroup,
  onProfile,
  onlineUsers,
}: SidebarProps) {
  const { profile, signOut } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const [searchQuery, setSearchQuery] = useState('');
  const [menuOpen, setMenuOpen] = useState(false);

  const filtered = chats.filter((chat) => {
    const name = getChatDisplayName(chat);
    return name.toLowerCase().includes(searchQuery.toLowerCase());
  });

  return (
    <div className="flex flex-col h-full bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700">
      {/* Header */}
      <div className="px-4 py-3.5 flex items-center justify-between border-b border-gray-100 dark:border-gray-700">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-full bg-messenger-blue flex items-center justify-center">
            <MessageCircle className="text-white" size={20} strokeWidth={2.5} />
          </div>
          <h1 className="text-xl font-bold text-gray-900 dark:text-white">Messenger</h1>
        </div>

        <div className="flex items-center gap-1">
          <button
            onClick={onNewGroup}
            className="p-2.5 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-300 transition-colors"
            title="New group"
          >
            <Users size={20} />
          </button>
          <button
            onClick={onNewChat}
            className="p-2.5 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-300 transition-colors"
            title="New chat"
          >
            <Edit size={20} />
          </button>
          <div className="relative">
            <button
              onClick={() => setMenuOpen(!menuOpen)}
              className="p-2.5 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-300 transition-colors"
              title="Menu"
            >
              <Settings size={20} />
            </button>
            {menuOpen && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setMenuOpen(false)} />
                <div className="absolute right-0 top-full mt-1 z-20 w-48 bg-white dark:bg-gray-700 rounded-xl shadow-lg border border-gray-100 dark:border-gray-600 py-1.5 animate-scale-in">
                  <button
                    onClick={() => {
                      setMenuOpen(false);
                      onProfile();
                    }}
                    className="w-full px-4 py-2.5 text-left text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-600 flex items-center gap-3"
                  >
                    <Settings size={16} /> Settings
                  </button>
                  <button
                    onClick={() => {
                      setMenuOpen(false);
                      toggleTheme();
                    }}
                    className="w-full px-4 py-2.5 text-left text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-600 flex items-center gap-3"
                  >
                    {theme === 'light' ? <Moon size={16} /> : <Sun size={16} />}
                    {theme === 'light' ? 'Dark mode' : 'Light mode'}
                  </button>
                  <div className="h-px bg-gray-100 dark:bg-gray-600 my-1" />
                  <button
                    onClick={() => {
                      setMenuOpen(false);
                      signOut();
                    }}
                    className="w-full px-4 py-2.5 text-left text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 flex items-center gap-3"
                  >
                    <LogOut size={16} /> Sign out
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Search */}
      <div className="px-4 py-3">
        <div className="relative">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search chats..."
            className="w-full pl-10 pr-9 py-2.5 rounded-full bg-gray-100 dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-messenger-blue transition-all text-sm"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
            >
              <X size={16} />
            </button>
          )}
        </div>
      </div>

      {/* Chat list */}
      <div className="flex-1 overflow-y-auto scrollbar-thin">
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center px-6 py-12">
            <div className="w-16 h-16 rounded-full bg-gray-100 dark:bg-gray-700 flex items-center justify-center mb-3">
              <MessageCircle className="text-gray-400" size={28} />
            </div>
            <p className="text-gray-500 dark:text-gray-400 font-medium">No chats yet</p>
            <p className="text-gray-400 dark:text-gray-500 text-sm mt-1">
              Start a new conversation
            </p>
          </div>
        ) : (
          filtered.map((chat) => {
            const isOnline = !chat.is_group && chat.other_member
              ? onlineUsers.has(chat.other_member.id)
              : false;
            const lastMsg = chat.last_message;
            const isActive = chat.id === activeChatId;

            return (
              <button
                key={chat.id}
                onClick={() => onSelectChat(chat.id)}
                className={`w-full px-3 py-2.5 flex items-center gap-3 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors text-left ${
                  isActive ? 'bg-messenger-blue-light dark:bg-gray-700' : ''
                }`}
              >
                <Avatar
                  profile={chat.is_group ? undefined : chat.other_member}
                  name={getChatDisplayName(chat)}
                  size="md"
                  showStatus={!chat.is_group}
                  isOnline={isOnline}
                />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <h3 className="font-semibold text-gray-900 dark:text-white truncate text-[15px]">
                      {getChatDisplayName(chat)}
                    </h3>
                    {lastMsg && (
                      <span className="text-xs text-gray-400 dark:text-gray-500 shrink-0 ml-2">
                        {formatTime(lastMsg.created_at)}
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-gray-500 dark:text-gray-400 truncate">
                    {lastMsg
                      ? lastMsg.deleted_at
                        ? 'Message deleted'
                        : lastMsg.content || (lastMsg.attachment_url ? 'Attachment' : '')
                      : 'No messages yet'}
                  </p>
                </div>
              </button>
            );
          })
        )}
      </div>

      {/* Current user footer */}
      <div className="px-4 py-3 border-t border-gray-100 dark:border-gray-700 flex items-center gap-3">
        <Avatar
          profile={profile}
          size="sm"
          showStatus
          isOnline={true}
        />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-gray-900 dark:text-white truncate">
            {displayName(profile)}
          </p>
          <p className="text-xs text-green-600 dark:text-green-400">Active now</p>
        </div>
      </div>
    </div>
  );
}
