import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import type { ChatWithDetails, Message, Profile, ChatMember } from '@/types';

export function useChats() {
  const { user } = useAuth();
  const [chats, setChats] = useState<ChatWithDetails[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeChatId, setActiveChatId] = useState<string | null>(null);

  const fetchChats = useCallback(async () => {
    if (!user) return;

    const { data: memberRows, error } = await supabase
      .from('chat_members')
      .select('chat_id')
      .eq('user_id', user.id);

    if (error || !memberRows || memberRows.length === 0) {
      setChats([]);
      setLoading(false);
      return;
    }

    const chatIds = memberRows.map((r) => r.chat_id);

    const { data: chatRows, error: chatErr } = await supabase
      .from('chats')
      .select('*')
      .in('id', chatIds)
      .order('last_message_at', { ascending: false });

    if (chatErr || !chatRows) {
      setChats([]);
      setLoading(false);
      return;
    }

    const { data: allMembers } = await supabase
      .from('chat_members')
      .select('chat_id, user_id, role, joined_at, profile:profiles(*)')
      .in('chat_id', chatIds);

    const { data: lastMessages } = await supabase
      .from('messages')
      .select('id, chat_id, sender_id, content, attachment_url, deleted_at, created_at')
      .in('chat_id', chatIds)
      .order('created_at', { ascending: false });

    const lastMsgPerChat: Record<string, Message> = {};
    if (lastMessages) {
      for (const msg of lastMessages) {
        if (!lastMsgPerChat[msg.chat_id]) {
          lastMsgPerChat[msg.chat_id] = msg as Message;
        }
      }
    }

    const membersByChat: Record<string, ChatMember[]> = {};
    if (allMembers) {
      for (const m of allMembers) {
        const member = {
          chat_id: m.chat_id,
          user_id: m.user_id,
          role: m.role,
          joined_at: m.joined_at,
          profile: Array.isArray(m.profile) ? m.profile[0] : m.profile,
        } as ChatMember;
        if (!membersByChat[m.chat_id]) membersByChat[m.chat_id] = [];
        membersByChat[m.chat_id].push(member);
      }
    }

    const enriched: ChatWithDetails[] = chatRows.map((chat) => {
      const members = membersByChat[chat.id] || [];
      const otherMember = chat.is_group
        ? null
        : members.find((m) => m.user_id !== user.id)?.profile ?? null;
      return {
        ...chat,
        members,
        other_member: otherMember,
        last_message: lastMsgPerChat[chat.id] || null,
        unread_count: 0,
      };
    });

    setChats(enriched);
    setLoading(false);
  }, [user]);

  useEffect(() => {
    fetchChats();
  }, [fetchChats]);

  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel('chats-list-changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'chats' },
        () => {
          fetchChats();
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'chat_members' },
        () => {
          fetchChats();
        }
      )
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'messages' },
        () => {
          fetchChats();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, fetchChats]);

  return { chats, loading, activeChatId, setActiveChatId, refreshChats: fetchChats };
}

export function useOnlineUsers() {
  const [onlineUsers, setOnlineUsers] = useState<Set<string>>(new Set());
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  useEffect(() => {
    const channel = supabase.channel('presence-chat', {
      config: {
        presence: { key: 'user' },
      },
    });

    channelRef.current = channel;

    channel
      .on('presence', { event: 'sync' }, () => {
        const state = channel.presenceState<{
          user_id: string;
        }>();
        const ids = new Set<string>();
        for (const key in state) {
          for (const pres of state[key]) {
            if (pres.user_id) ids.add(pres.user_id);
          }
        }
        setOnlineUsers(ids);
      })
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          const { data: { user } } = await supabase.auth.getUser();
          if (user) {
            await channel.track({ user_id: user.id, online_at: new Date().toISOString() });
          }
        }
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  return onlineUsers;
}

export function useMessages(chatId: string | null) {
  const { user } = useAuth();
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchMessages = useCallback(async () => {
    if (!chatId) return;
    setLoading(true);

    const { data, error } = await supabase
      .from('messages')
      .select('*')
      .eq('chat_id', chatId)
      .order('created_at', { ascending: true })
      .limit(200);

    if (error) {
      console.error('Error fetching messages:', error);
      setLoading(false);
      return;
    }

    setMessages((data as Message[]) || []);
    setLoading(false);
  }, [chatId]);

  useEffect(() => {
    fetchMessages();
  }, [fetchMessages]);

  useEffect(() => {
    if (!chatId) return;
    const channel = supabase
      .channel(`messages-${chatId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'messages', filter: `chat_id=eq.${chatId}` },
        (payload) => {
          const newMsg = payload.new as Message;
          setMessages((prev) => {
            if (prev.some((m) => m.id === newMsg.id)) return prev;
            return [...prev, newMsg];
          });
        }
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'messages', filter: `chat_id=eq.${chatId}` },
        () => {
          fetchMessages();
        }
      )
      .on(
        'postgres_changes',
        { event: 'DELETE', schema: 'public', table: 'messages', filter: `chat_id=eq.${chatId}` },
        () => {
          fetchMessages();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [chatId, fetchMessages]);

  // Mark messages as read
  useEffect(() => {
    if (!chatId || !user || messages.length === 0) return;
    const unread = messages.filter(
      (m) => m.sender_id !== user.id && !(m.reads || []).some((r) => r.user_id === user.id)
    );
    if (unread.length === 0) return;

    const markRead = async () => {
      const inserts = unread.map((m) => ({
        message_id: m.id,
        user_id: user.id,
      }));
      await supabase.from('message_reads').upsert(inserts, { onConflict: 'message_id,user_id' });
    };
    markRead();
  }, [chatId, user, messages]);

  return { messages, loading, refreshMessages: fetchMessages };
}

export function useTypingIndicator(chatId: string | null) {
  const { user } = useAuth();
  const [typingUsers, setTypingUsers] = useState<Set<string>>(new Set());
  const typingTimeoutRef = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

  useEffect(() => {
    if (!chatId) return;

    const channel = supabase.channel(`typing-${chatId}`);

    channel
      .on('broadcast', { event: 'typing' }, (payload) => {
        const { user_id, isTyping } = payload.payload as { user_id: string; isTyping: boolean };
        if (user_id === user?.id) return;

        setTypingUsers((prev) => {
          const next = new Set(prev);
          if (isTyping) {
            next.add(user_id);
          } else {
            next.delete(user_id);
          }
          return next;
        });

        if (isTyping) {
          if (typingTimeoutRef.current[user_id]) {
            clearTimeout(typingTimeoutRef.current[user_id]);
          }
          typingTimeoutRef.current[user_id] = setTimeout(() => {
            setTypingUsers((prev) => {
              const next = new Set(prev);
              next.delete(user_id);
              return next;
            });
          }, 4000);
        }
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
      Object.values(typingTimeoutRef.current).forEach(clearTimeout);
    };
  }, [chatId, user?.id]);

  const sendTyping = useCallback(
    (isTyping: boolean) => {
      if (!chatId || !user) return;
      const channel = supabase.channel(`typing-${chatId}`);
      channel.send({
        type: 'broadcast',
        event: 'typing',
        payload: { user_id: user.id, isTyping },
      });
    },
    [chatId, user]
  );

  return { typingUsers, sendTyping };
}

export function useSearchUsers() {
  const [results, setResults] = useState<Profile[]>([]);
  const [searching, setSearching] = useState(false);

  const search = useCallback(async (query: string, excludeIds: string[] = []) => {
    setSearching(true);
    let q = supabase
      .from('profiles')
      .select('*')
      .order('full_name', { ascending: true })
      .limit(20);

    if (query.trim()) {
      q = q.or(`username.ilike.%${query}%,full_name.ilike.%${query}%`);
    }

    const { data, error } = await q;

    if (!error && data) {
      const filtered = (data as Profile[]).filter((p) => !excludeIds.includes(p.id));
      setResults(filtered);
    }
    setSearching(false);
  }, []);

  return { results, searching, search };
}

export async function createGroupChat(
  currentUserId: string,
  name: string,
  memberIds: string[]
): Promise<string | null> {
  const { data: newChat, error: chatErr } = await supabase
    .from('chats')
    .insert({ is_group: true, name, created_by: currentUserId })
    .select()
    .single();

  if (chatErr || !newChat) return null;

  const { error: adminErr } = await supabase.from('chat_members').insert({
    chat_id: newChat.id,
    user_id: currentUserId,
    role: 'admin',
  });

  if (adminErr) {
    console.error('Admin insert error:', adminErr);
    return null;
  }

  for (const id of memberIds.filter((id) => id !== currentUserId)) {
    const { error: memberErr } = await supabase.from('chat_members').insert({
      chat_id: newChat.id,
      user_id: id,
      role: 'member',
    });
    if (memberErr) {
      console.error('Member insert error:', memberErr);
    }
  }

  return newChat.id;
}
