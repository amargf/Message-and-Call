import { useState } from 'react';
import { X, Trash2, LogOut, Crown, UserMinus } from 'lucide-react';
import Avatar from '@/components/Avatar';
import { useAuth } from '@/context/AuthContext';
import { useOnlineUsers } from '@/hooks/useChats';
import { supabase } from '@/lib/supabase';
import { displayName, formatLastSeen } from '@/lib/utils';
import type { ChatWithDetails } from '@/types';

interface ChatInfoPanelProps {
  chat: ChatWithDetails | null;
  open: boolean;
  onClose: () => void;
  onChatDeleted: () => void;
}

export default function ChatInfoPanel({
  chat,
  open,
  onClose,
  onChatDeleted,
}: ChatInfoPanelProps) {
  const { user } = useAuth();
  const onlineUsers = useOnlineUsers();
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [loading, setLoading] = useState(false);

  if (!chat) return null;
  const {
    id: chatId,
    is_group,
    name,
    avatar_url,
    other_member,
  } = chat;

  const members = chat.members || [];
  const myRole = members.find((m) => m.user_id === user?.id)?.role;
  const isAdmin = myRole === 'admin';

  const handleLeaveGroup = async () => {
    if (!user) return;
    setLoading(true);
    const { error } = await supabase
      .from('chat_members')
      .delete()
      .eq('chat_id', chatId)
      .eq('user_id', user.id);
    if (!error) {
      onChatDeleted();
      onClose();
    }
    setLoading(false);
  };

  const handleDeleteChat = async () => {
    if (!user) return;
    setLoading(true);
    const { error: memberErr } = await supabase
      .from('chat_members')
      .delete()
      .eq('chat_id', chatId);
    if (!memberErr) {
      const { error } = await supabase.from('chats').delete().eq('id', chatId);
      if (!error) {
        onChatDeleted();
        onClose();
      }
    }
    setLoading(false);
  };

  const handleRemoveMember = async (memberId: string) => {
    if (!isAdmin) return;
    await supabase.from('chat_members').delete().eq('chat_id', chatId).eq('user_id', memberId);
  };

  const groupName = is_group ? name || 'Group' : displayName(other_member);

  return (
    <>
      <div
        className={`fixed inset-0 z-40 bg-black/30 backdrop-blur-sm transition-opacity ${
          open ? 'opacity-100' : 'opacity-0 pointer-events-none'
        }`}
        onClick={onClose}
      />
      <div
        className={`fixed top-0 right-0 bottom-0 z-40 w-full max-w-sm bg-white dark:bg-gray-800 shadow-2xl transition-transform duration-300 flex flex-col ${
          open ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        {/* Header */}
        <div className="px-4 py-3.5 flex items-center justify-between border-b border-gray-100 dark:border-gray-700 shrink-0">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Chat info</h2>
          <button
            onClick={onClose}
            className="p-1.5 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-500 dark:text-gray-400 transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto scrollbar-thin">
          {/* Profile section */}
          <div className="flex flex-col items-center py-6 px-4 border-b border-gray-100 dark:border-gray-700">
            <Avatar
              profile={is_group ? undefined : other_member}
              name={groupName}
              src={is_group ? avatar_url : undefined}
              size="xl"
              showStatus={!is_group}
              isOnline={!is_group && other_member ? onlineUsers.has(other_member.id) : false}
            />
            <h3 className="mt-3 text-xl font-bold text-gray-900 dark:text-white">{groupName}</h3>
            {!is_group && other_member && (
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                @{other_member.username}
              </p>
            )}
            {is_group && (
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                {members.length} members
              </p>
            )}
          </div>

          {/* Members (group only) */}
          {is_group && (
            <div className="p-4">
              <h4 className="text-sm font-semibold text-gray-500 dark:text-gray-400 mb-3 uppercase tracking-wide">
                Members
              </h4>
              <div className="space-y-1">
                {members.map((member) => {
                  const isOnline = onlineUsers.has(member.user_id);
                  const isMe = member.user_id === user?.id;
                  return (
                    <div
                      key={member.user_id}
                      className="flex items-center gap-3 p-2 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                    >
                      <Avatar
                        profile={member.profile}
                        size="md"
                        showStatus
                        isOnline={isOnline}
                      />
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-gray-900 dark:text-white truncate">
                          {displayName(member.profile)}
                          {isMe && (
                            <span className="text-gray-400 dark:text-gray-500 font-normal text-sm ml-1">
                              (You)
                            </span>
                          )}
                        </p>
                        <p className="text-xs text-gray-500 dark:text-gray-400">
                          {isOnline
                            ? 'Active now'
                            : formatLastSeen(member.profile?.last_seen || new Date().toISOString(), false)}
                        </p>
                      </div>
                      {member.role === 'admin' && (
                        <span className="text-amber-500">
                          <Crown size={16} />
                        </span>
                      )}
                      {isAdmin && !isMe && member.role !== 'admin' && (
                        <button
                          onClick={() => handleRemoveMember(member.user_id)}
                          className="p-1.5 rounded-full hover:bg-red-50 dark:hover:bg-red-900/20 text-gray-400 hover:text-red-500 transition-colors"
                          title="Remove member"
                        >
                          <UserMinus size={16} />
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="p-4 border-t border-gray-100 dark:border-gray-700 space-y-2">
            {is_group ? (
              <button
                onClick={handleLeaveGroup}
                disabled={loading}
                className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors font-medium"
              >
                <LogOut size={20} /> Leave group
              </button>
            ) : (
              <button
                onClick={() => {
                  setConfirmDelete(true);
                }}
                disabled={loading}
                className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors font-medium"
              >
                <Trash2 size={20} /> Delete conversation
              </button>
            )}
            {is_group && isAdmin && (
              <button
                onClick={() => setConfirmDelete(true)}
                disabled={loading}
                className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors font-medium"
              >
                <Trash2 size={20} /> Delete group
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Confirm delete modal */}
      {confirmDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 animate-fade-in">
          <div
            className="absolute inset-0 bg-black/50"
            onClick={() => setConfirmDelete(false)}
          />
          <div className="relative w-full max-w-sm bg-white dark:bg-gray-800 rounded-2xl shadow-2xl p-6 animate-scale-in">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
              {is_group ? 'Delete group?' : 'Delete conversation?'}
            </h3>
            <p className="text-gray-500 dark:text-gray-400 mb-6">
              {is_group
                ? 'This will permanently delete the group and all its messages for everyone.'
                : 'This will permanently delete all messages in this conversation.'}
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setConfirmDelete(false)}
                className="flex-1 py-2.5 rounded-xl bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 font-semibold hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteChat}
                disabled={loading}
                className="flex-1 py-2.5 rounded-xl bg-red-500 hover:bg-red-600 text-white font-semibold transition-colors"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
