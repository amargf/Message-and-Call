import { useState, useRef, useEffect, useMemo } from 'react';
import {
  ArrowLeft,
  Phone,
  Video,
  Info,
  Send,
  Smile,
  X,
  Image as ImageIcon,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import { useMessages, useTypingIndicator } from '@/hooks/useChats';
import type { ChatWithDetails, Message } from '@/types';
import {
  displayName,
  formatLastSeen,
  formatDateSeparator,
  groupMessagesByDate,
} from '@/lib/utils';
import Avatar from '@/components/Avatar';
import MessageBubble from '@/components/MessageBubble';
import CallModal from '@/components/CallModal';

interface ChatViewProps {
  chat: ChatWithDetails;
  onBack: () => void;
  onShowInfo: () => void;
  onlineUsers: Set<string>;
}

const EMOJI_LIST = [
  '😀', '😂', '🥰', '😍', '😘', '😜', '🤔', '😎',
  '😢', '😭', '😡', '🥺', '😱', '🤯', '😴', '🤤',
  '👍', '👎', '👏', '🙏', '💪', '🤝', '✌️', '🤞',
  '❤️', '🧡', '💛', '💚', '💙', '💜', '🖤', '🤍',
  '🔥', '⭐', '✨', '🎉', '🎁', '🎂', '🌸', '🌈',
];

export default function ChatView({ chat, onBack, onShowInfo, onlineUsers }: ChatViewProps) {
  const { user } = useAuth();
  const { messages, loading } = useMessages(chat.id);
  const { typingUsers, sendTyping } = useTypingIndicator(chat.id);
  const [input, setInput] = useState('');
  const [showEmojis, setShowEmojis] = useState(false);
  const [replyTo, setReplyTo] = useState<Message | null>(null);
  const [editingMessage, setEditingMessage] = useState<Message | null>(null);
  const [sending, setSending] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [activeCallType, setActiveCallType] = useState<'audio' | 'video' | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isTypingRef = useRef(false);

  const isGroup = chat.is_group;
  const otherMember = chat.other_member;
  const otherOnline = otherMember ? onlineUsers.has(otherMember.id) : false;

  const members = chat.members || [];
  const typingMemberNames = useMemo(() => {
    return Array.from(typingUsers)
      .map((uid) => members.find((m) => m.user_id === uid)?.profile)
      .filter(Boolean)
      .map((p) => displayName(p));
  }, [typingUsers, members]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    if (editingMessage) {
      setInput(editingMessage.content || '');
      inputRef.current?.focus();
    }
  }, [editingMessage]);

  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value);
    if (editingMessage) return;

    if (!isTypingRef.current) {
      isTypingRef.current = true;
      sendTyping(true);
    }

    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    typingTimeoutRef.current = setTimeout(() => {
      isTypingRef.current = false;
      sendTyping(false);
    }, 2000);
  };

  const handleSend = async (attachmentUrl?: string) => {
    if ((!input.trim() && !attachmentUrl) || !user || sending) return;
    setSending(true);

    if (editingMessage) {
      const { error } = await supabase
        .from('messages')
        .update({ content: input.trim(), edited_at: new Date().toISOString() })
        .eq('id', editingMessage.id);
      if (error) console.error('Edit error:', error);
      setEditingMessage(null);
    } else {
      const { error } = await supabase.from('messages').insert({
        chat_id: chat.id,
        sender_id: user.id,
        content: input.trim() || null,
        attachment_url: attachmentUrl || null,
        reply_to_id: replyTo?.id || null,
      });
      if (error) console.error('Send error:', error);
    }

    if (isTypingRef.current) {
      isTypingRef.current = false;
      sendTyping(false);
    }

    setInput('');
    setReplyTo(null);
    setSending(false);
    inputRef.current?.focus();
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;

    setUploading(true);
    const fileExt = file.name.split('.').pop();
    const randomString = Math.random().toString(36).slice(2);
    const fileName = `${randomString}-${Date.now()}.${fileExt}`;
    const filePath = `${chat.id}/${fileName}`;

    try {
      const { error: uploadError } = await supabase.storage
        .from('chat-attachments')
        .upload(filePath, file);

      if (uploadError) {
        console.error('Upload error:', uploadError);
        alert('فشل رفع الملف. تأكد من إعدادات Storage Bucket في Supabase باسم chat-attachments');
        setUploading(false);
        return;
      }

      const { data: publicUrlData } = supabase.storage
        .from('chat-attachments')
        .getPublicUrl(filePath);

      await handleSend(publicUrlData.publicUrl);
    } catch (err) {
      console.error('Unexpected error during upload:', err);
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
    if (e.key === 'Escape') {
      setEditingMessage(null);
      setReplyTo(null);
      setInput('');
    }
  };

  const handleReact = async (messageId: string, emoji: string) => {
    if (!user) return;
    const existing = messages.find((m) => m.id === messageId)?.reactions || [];
    const mine = existing.find((r) => r.user_id === user.id && r.emoji === emoji);

    if (mine) {
      await supabase.from('reactions').delete().eq('id', mine.id);
    } else {
      await supabase.from('reactions').insert({
        message_id: messageId,
        user_id: user.id,
        emoji,
      });
    }
  };

  const handleDelete = async (message: Message) => {
    if (!user) return;
    if (message.sender_id === user.id) {
      await supabase
        .from('messages')
        .update({ deleted_at: new Date().toISOString(), content: null, attachment_url: null })
        .eq('id', message.id);
    }
  };

  const handleEdit = (message: Message) => {
    setEditingMessage(message);
    setReplyTo(null);
  };

  const messageGroups = useMemo(() => groupMessagesByDate(messages), [messages]);

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center bg-chat-light dark:bg-chat-dark">
        <div className="w-8 h-8 border-2 border-messenger-blue border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col h-full bg-chat-light dark:bg-chat-dark">
      {/* Header */}
      <div className="px-4 py-2.5 flex items-center gap-3 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 shrink-0">
        <button
          onClick={onBack}
          className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-300 transition-colors md:hidden"
        >
          <ArrowLeft size={20} />
        </button>

        <button onClick={onShowInfo} className="flex items-center gap-3 flex-1 min-w-0 text-left">
          <Avatar
            profile={isGroup ? undefined : otherMember}
            name={isGroup ? chat.name || 'Group' : displayName(otherMember)}
            size="sm"
            showStatus={!isGroup}
            isOnline={otherOnline}
          />
          <div className="min-w-0">
            <h2 className="font-semibold text-gray-900 dark:text-white truncate">
              {isGroup ? chat.name : displayName(otherMember)}
            </h2>
            <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
              {typingMemberNames.length > 0 ? (
                <span className="text-messenger-blue">
                  {typingMemberNames.length === 1
                    ? `${typingMemberNames[0]} is typing...`
                    : `${typingMemberNames.join(', ')} are typing...`}
                </span>
              ) : isGroup ? (
                `${members.length} members`
              ) : (
                formatLastSeen(otherMember?.last_seen || new Date().toISOString(), otherOnline)
              )}
            </p>
          </div>
        </button>

        <div className="flex items-center gap-1">
          <button
            onClick={() => setActiveCallType('audio')}
            className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-300 transition-colors"
            title="مكالمة صوتية"
          >
            <Phone size={20} />
          </button>
          <button
            onClick={() => setActiveCallType('video')}
            className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-300 transition-colors"
            title="مكالمة فيديو"
          >
            <Video size={20} />
          </button>
          <button
            onClick={onShowInfo}
            className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-300 transition-colors"
          >
            <Info size={20} />
          </button>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto scrollbar-thin px-4 py-4">
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <div className="w-20 h-20 rounded-full bg-white dark:bg-gray-700 flex items-center justify-center mb-4 shadow-sm">
              <Avatar
                profile={isGroup ? undefined : otherMember}
                name={isGroup ? chat.name || 'Group' : displayName(otherMember)}
                size="xl"
              />
            </div>
            <p className="text-gray-500 dark:text-gray-400">
              This is the beginning of your conversation
            </p>
            <p className="text-gray-400 dark:text-gray-500 text-sm mt-1">
              Send a message to start chatting
            </p>
          </div>
        ) : (
          messageGroups.map((group, gi) => (
            <div key={gi}>
              <div className="flex items-center justify-center my-4">
                <span className="px-3 py-1 rounded-full bg-white dark:bg-gray-700 text-xs text-gray-500 dark:text-gray-400 shadow-sm font-medium">
                  {formatDateSeparator(group[0].created_at)}
                </span>
              </div>
              {group.map((msg, mi) => {
                const prevMsg = mi > 0 ? group[mi - 1] : null;
                const nextMsg = mi < group.length - 1 ? group[mi + 1] : null;
                const showAvatar =
                  !prevMsg || prevMsg.sender_id !== msg.sender_id || !nextMsg;
                const sender = members.find((m) => m.user_id === msg.sender_id)?.profile || null;
                return (
                  <MessageBubble
                    key={msg.id}
                    message={msg}
                    isGroup={isGroup}
                    sender={sender}
                    showAvatar={showAvatar}
                    isReply={!!prevMsg && prevMsg.sender_id === msg.sender_id}
                    onReply={(m) => setReplyTo(m)}
                    onEdit={handleEdit}
                    onDelete={handleDelete}
                    onReact={handleReact}
                  />
                );
              })}
            </div>
          ))
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Reply / Edit banner */}
      {(replyTo || editingMessage) && (
        <div className="px-4 py-2 bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700 flex items-center gap-3 animate-slide-up">
          <div className="w-1 h-8 bg-messenger-blue rounded-full shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-xs font-semibold text-messenger-blue">
              {editingMessage ? 'Editing message' : 'Replying to message'}
            </p>
            <p className="text-sm text-gray-500 dark:text-gray-400 truncate">
              {editingMessage?.content || replyTo?.content}
            </p>
          </div>
          <button
            onClick={() => {
              setReplyTo(null);
              setEditingMessage(null);
              setInput('');
            }}
            className="p-1.5 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-500 dark:text-gray-400"
          >
            <X size={18} />
          </button>
        </div>
      )}

      {/* Emoji picker */}
      {showEmojis && (
        <div className="px-4 py-2 bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700 animate-slide-up">
          <div className="grid grid-cols-8 gap-1 max-h-32 overflow-y-auto scrollbar-thin">
            {EMOJI_LIST.map((emoji) => (
              <button
                key={emoji}
                onClick={() => {
                  setInput((prev) => prev + emoji);
                  inputRef.current?.focus();
                }}
                className="text-2xl p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
              >
                {emoji}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Input */}
      <div className="px-4 py-3 bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700 shrink-0">
        <input
          type="file"
          ref={fileInputRef}
          onChange={handleFileUpload}
          accept="image/*,video/*"
          className="hidden"
        />
        <div className="flex items-end gap-2">
          <button
            onClick={() => setShowEmojis(!showEmojis)}
            className="p-2.5 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-500 dark:text-gray-400 transition-colors shrink-0"
          >
            <Smile size={22} />
          </button>
          
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            className="p-2.5 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-500 dark:text-gray-400 transition-colors shrink-0 disabled:opacity-50"
          >
            {uploading ? (
              <div className="w-5 h-5 border-2 border-messenger-blue border-t-transparent rounded-full animate-spin" />
            ) : (
              <ImageIcon size={22} />
            )}
          </button>

          <div className="flex-1 bg-gray-100 dark:bg-gray-700 rounded-3xl px-4 py-2.5 flex items-end">
            <textarea
              ref={inputRef}
              value={input}
              onChange={handleInputChange}
              onKeyDown={handleKeyDown}
              rows={1}
              placeholder={editingMessage ? 'Edit your message...' : uploading ? 'Uploading file...' : 'Aa'}
              className="flex-1 bg-transparent text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none resize-none max-h-32 scrollbar-thin text-[15px]"
              style={{ minHeight: '24px' }}
            />
          </div>

          <button
            onClick={() => handleSend()}
            disabled={(!input.trim() && !uploading) || sending}
            className="p-3 rounded-full bg-messenger-blue hover:bg-messenger-blue-dark text-white transition-all disabled:opacity-40 disabled:cursor-not-allowed shrink-0 shadow-md shadow-blue-500/20"
          >
            <Send size={20} />
          </button>
        </div>
      </div>

      {/* Call Modal */}
      {activeCallType && otherMember && (
        <CallModal
          chatId={chat.id}
          recipientId={otherMember.id}
          callType={activeCallType}
          onClose={() => setActiveCallType(null)}
        />
      )}
    </div>
  );
}
