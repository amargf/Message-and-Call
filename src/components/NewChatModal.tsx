import { useState, useEffect } from 'react';
import { Search, Loader2, Check } from 'lucide-react';
import Modal from '@/components/Modal';
import Avatar from '@/components/Avatar';
import { useSearchUsers } from '@/hooks/useChats';
import { useAuth } from '@/context/AuthContext';
import { displayName } from '@/lib/utils';
import { supabase } from '@/lib/supabase';
import type { Profile } from '@/types';

interface NewChatModalProps {
  open: boolean;
  onClose: () => void;
  onChatCreated: (chatId: string) => void;
}

export default function NewChatModal({ open, onClose, onChatCreated }: NewChatModalProps) {
  const { user } = useAuth();
  const { results, searching, search } = useSearchUsers();
  const [query, setQuery] = useState('');
  const [starting, setStarting] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setQuery('');
      search('', [user?.id || '']);
    }
  }, [open, search, user?.id]);

  const handleStart = async (otherUser: Profile) => {
    if (!user) return;
    setStarting(otherUser.id);

    // Find existing direct chat
    const { data: myChats } = await supabase
      .from('chat_members')
      .select('chat_id')
      .eq('user_id', user.id);

    let existingChatId: string | null = null;

    if (myChats && myChats.length > 0) {
      const chatIds = myChats.map((c) => c.chat_id);
      const { data: otherMember } = await supabase
        .from('chat_members')
        .select('chat_id')
        .eq('user_id', otherUser.id)
        .in('chat_id', chatIds);

      if (otherMember && otherMember.length > 0) {
        const candidateIds = otherMember.map((m) => m.chat_id);
        const { data: chats } = await supabase
          .from('chats')
          .select('id')
          .eq('is_group', false)
          .in('id', candidateIds);
        if (chats && chats.length > 0) {
          existingChatId = chats[0].id;
        }
      }
    }

    if (existingChatId) {
      onChatCreated(existingChatId);
      setStarting(null);
      onClose();
      return;
    }

    // Create new chat
    const { data: newChat, error } = await supabase
      .from('chats')
      .insert({ is_group: false, created_by: user.id })
      .select()
      .single();

    if (error || !newChat) {
      console.error('Chat creation error:', error);
      setStarting(null);
      return;
    }

    // Insert members one at a time — RLS can't see row 1 when evaluating
    // row 2's policy in a single batch INSERT.
    const { error: adminErr } = await supabase.from('chat_members').insert({
      chat_id: newChat.id,
      user_id: user.id,
      role: 'admin',
    });

    if (adminErr) {
      console.error('Admin member insert error:', adminErr);
      setStarting(null);
      return;
    }

    const { error: memberErr } = await supabase.from('chat_members').insert({
      chat_id: newChat.id,
      user_id: otherUser.id,
      role: 'member',
    });

    if (memberErr) {
      console.error('Other member insert error:', memberErr);
    }

    onChatCreated(newChat.id);
    setStarting(null);
    onClose();
  };

  return (
    <Modal open={open} onClose={onClose} title="New chat">
      <div className="p-5">
        <div className="relative mb-4">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
          <input
            type="text"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              search(e.target.value, [user?.id || '']);
            }}
            placeholder="Search by name or username..."
            className="w-full pl-10 pr-4 py-2.5 rounded-full bg-gray-100 dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-messenger-blue transition-all"
            autoFocus
          />
        </div>

        {searching ? (
          <div className="flex justify-center py-8">
            <Loader2 className="animate-spin text-gray-400" size={24} />
          </div>
        ) : results.length === 0 ? (
          <div className="text-center py-8 text-gray-500 dark:text-gray-400">
            {query ? 'No users found' : 'Start typing to search for users'}
          </div>
        ) : (
          <div className="space-y-1 max-h-80 overflow-y-auto scrollbar-thin">
            {results.map((profile) => (
              <button
                key={profile.id}
                onClick={() => handleStart(profile)}
                disabled={starting !== null}
                className="w-full flex items-center gap-3 p-2.5 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors text-left disabled:opacity-60"
              >
                <Avatar profile={profile} size="md" />
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-gray-900 dark:text-white truncate">
                    {displayName(profile)}
                  </p>
                  <p className="text-sm text-gray-500 dark:text-gray-400 truncate">
                    @{profile.username}
                  </p>
                </div>
                {starting === profile.id ? (
                  <Loader2 className="animate-spin text-messenger-blue" size={20} />
                ) : (
                  <div className="w-9 h-9 rounded-full bg-messenger-blue flex items-center justify-center text-white shrink-0">
                    <Check size={18} />
                  </div>
                )}
              </button>
            ))}
          </div>
        )}
      </div>
    </Modal>
  );
}
