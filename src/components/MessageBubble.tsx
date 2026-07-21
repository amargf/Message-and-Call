import { useState, useRef, useEffect } from 'react';
import {
  Smile,
  Reply,
  Pencil,
  Trash2,
  Check,
  CheckCheck,
  MoreHorizontal,
} from 'lucide-react';
import type { Message, Profile } from '@/types';
import { useAuth } from '@/context/AuthContext';
import { formatShortTime, displayName } from '@/lib/utils';
import Avatar from '@/components/Avatar';

interface MessageBubbleProps {
  message: Message;
  isGroup: boolean;
  sender: Profile | null;
  showAvatar: boolean;
  isReply: boolean;
  onReply: (message: Message) => void;
  onEdit: (message: Message) => void;
  onDelete: (message: Message) => void;
  onReact: (messageId: string, emoji: string) => void;
}

const QUICK_EMOJIS = ['👍', '❤️', '😂', '😮', '😢', '🙏'];

export default function MessageBubble({
  message,
  isGroup,
  sender,
  showAvatar,
  isReply,
  onReply,
  onEdit,
  onDelete,
  onReact,
}: MessageBubbleProps) {
  const { user } = useAuth();
  const [showReactions, setShowReactions] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const reactionRef = useRef<HTMLDivElement>(null);

  const isOwn = message.sender_id === user?.id;
  const isDeleted = !!message.deleted_at;
  const isEdited = !!message.edited_at && !isDeleted;

  const reads = message.reads || [];
  const otherReads = reads.filter((r) => r.user_id !== user?.id);

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setShowMenu(false);
      }
      if (reactionRef.current && !reactionRef.current.contains(e.target as Node)) {
        setShowReactions(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const reactions = message.reactions || [];
  const reactionGroups = reactions.reduce(
    (acc, r) => {
      if (!acc[r.emoji]) acc[r.emoji] = [];
      acc[r.emoji].push(r);
      return acc;
    },
    {} as Record<string, typeof reactions>
  );

  // Helper function to check if the attachment is a video
  const isVideo = (url: string | null) => {
    if (!url) return false;
    return url.match(/\.(mp4|webm|ogg)$/i) !== null;
  };

  return (
    <div
      className={`flex gap-2 group ${isOwn ? 'flex-row-reverse' : 'flex-row'} ${
        showAvatar ? 'mt-3' : 'mt-0.5'
      }`}
    >
      {/* Avatar slot */}
      <div className="w-8 shrink-0 flex justify-center">
        {showAvatar && !isOwn && !isDeleted && <Avatar profile={sender} size="xs" />}
      </div>

      <div className={`flex flex-col max-w-[75%] ${isOwn ? 'items-end' : 'items-start'}`}>
        {showAvatar && isGroup && !isOwn && !isDeleted && (
          <span className="text-xs font-semibold text-gray-600 dark:text-gray-300 mb-1 ml-1">
            {displayName(sender)}
          </span>
        )}

        {/* Reply preview */}
        {isReply && message.reply_to && !isDeleted && (
          <div
            className={`flex items-center gap-2 mb-1 px-3 py-1.5 rounded-lg bg-gray-100 dark:bg-gray-700 text-xs max-w-full ${
              isOwn ? 'self-end' : 'self-start'
            }`}
          >
            <div className="w-1 h-full bg-messenger-blue rounded-full self-stretch shrink-0" />
            <div className="truncate">
              <span className="font-semibold text-messenger-blue">
                {message.reply_to.sender_id === user?.id ? 'You' : displayName(sender)}
              </span>
              <p className="text-gray-500 dark:text-gray-400 truncate">
                {message.reply_to.content || 'Attachment'}
              </p>
            </div>
          </div>
        )}

        {/* Bubble */}
        <div className="relative">
          <div
            className={`px-3.5 py-2 rounded-2xl text-[15px] break-words relative ${
              isOwn
                ? 'bg-messenger-blue text-white rounded-tr-md'
                : 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded-tl-md'
            } ${isDeleted ? 'italic opacity-60' : ''} shadow-sm`}
          >
            {isDeleted ? (
              <span className="flex items-center gap-1.5">
                <Trash2 size={14} /> Message removed
              </span>
            ) : (
              <>
                {/* --- Added Attachment Viewer --- */}
                {message.attachment_url && (
                  <div className="mb-2 max-w-[250px] sm:max-w-xs rounded-lg overflow-hidden">
                    {isVideo(message.attachment_url) ? (
                      <video
                        controls
                        className="w-full h-auto rounded-md"
                        src={message.attachment_url}
                      />
                    ) : (
                      <img
                        src={message.attachment_url}
                        alt="attachment"
                        className="w-full h-auto rounded-md object-cover"
                        loading="lazy"
                      />
                    )}
                  </div>
                )}
                {/* ------------------------------- */}
                
                {message.content && (
                   <p className="whitespace-pre-wrap">{message.content}</p>
                )}
              </>
            )}

            <div className="flex items-center gap-1 mt-0.5 -mb-0.5">
              <span
                className={`text-[10px] ${isOwn ? 'text-blue-100' : 'text-gray-400 dark:text-gray-500'}`}
              >
                {formatShortTime(message.created_at)}
              </span>
              {isEdited && (
                <span
                  className={`text-[10px] ${isOwn ? 'text-blue-100' : 'text-gray-400 dark:text-gray-500'}`}
                >
                  · edited
                </span>
              )}
              {isOwn && !isDeleted && (
                <span className="flex items-center">
                  {otherReads.length > 0 ? (
                    <CheckCheck size={14} className="text-blue-100" />
                  ) : (
                    <Check size={14} className="text-blue-100" />
                  )}
                </span>
              )}
            </div>
          </div>

          {/* Hover actions */}
          {!isDeleted && (
            <div
              className={`absolute top-1/2 -translate-y-1/2 ${
                isOwn ? 'right-full mr-1' : 'left-full ml-1'
              } flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity bg-white dark:bg-gray-800 rounded-full shadow-md border border-gray-100 dark:border-gray-700 px-1 py-0.5`}
            >
              <button
                onClick={() => setShowReactions(!showReactions)}
                className="p-1.5 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-500 dark:text-gray-400 transition-colors"
                title="React"
              >
                <Smile size={16} />
              </button>
              <button
                onClick={() => onReply(message)}
                className="p-1.5 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-500 dark:text-gray-400 transition-colors"
                title="Reply"
              >
                <Reply size={16} />
              </button>
              <div ref={menuRef} className="relative">
                <button
                  onClick={() => setShowMenu(!showMenu)}
                  className="p-1.5 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-500 dark:text-gray-400 transition-colors"
                >
                  <MoreHorizontal size={16} />
                </button>
                {showMenu && (
                  <div
                    className={`absolute top-full mt-1 ${
                      isOwn ? 'right-0' : 'left-0'
                    } z-20 w-36 bg-white dark:bg-gray-700 rounded-lg shadow-lg border border-gray-100 dark:border-gray-600 py-1 animate-scale-in`}
                  >
                    {isOwn && (
                      <button
                        onClick={() => {
                          setShowMenu(false);
                          onEdit(message);
                        }}
                        className="w-full px-3 py-2 text-left text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-600 flex items-center gap-2"
                      >
                        <Pencil size={14} /> Edit
                      </button>
                    )}
                    <button
                      onClick={() => {
                        setShowMenu(false);
                        onDelete(message);
                      }}
                      className={`w-full px-3 py-2 text-left text-sm hover:bg-gray-50 dark:hover:bg-gray-600 flex items-center gap-2 ${
                        isOwn ? 'text-red-600 dark:text-red-400' : 'text-gray-700 dark:text-gray-200'
                      }`}
                    >
                      <Trash2 size={14} /> {isOwn ? 'Delete' : 'Remove'}
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Reaction picker */}
          {showReactions && (
            <div
              ref={reactionRef}
              className={`absolute -top-11 ${
                isOwn ? 'right-0' : 'left-0'
              } z-20 flex items-center gap-0.5 bg-white dark:bg-gray-700 rounded-full shadow-lg border border-gray-100 dark:border-gray-600 px-1.5 py-1 animate-scale-in`}
            >
              {QUICK_EMOJIS.map((emoji) => (
                <button
                  key={emoji}
                  onClick={() => {
                    onReact(message.id, emoji);
                    setShowReactions(false);
                  }}
                  className="text-xl hover:scale-125 transition-transform p-1"
                >
                  {emoji}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Reactions display */}
        {Object.keys(reactionGroups).length > 0 && (
          <div
            className={`flex flex-wrap gap-1 mt-1 ${isOwn ? 'justify-end' : 'justify-start'}`}
          >
            {Object.entries(reactionGroups).map(([emoji, users]) => {
              const hasMine = users.some((r) => r.user_id === user?.id);
              return (
                <button
                  key={emoji}
                  onClick={() => onReact(message.id, emoji)}
                  className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-xs border transition-colors ${
                    hasMine
                      ? 'bg-messenger-blue-light dark:bg-blue-900/30 border-messenger-blue text-messenger-blue dark:text-blue-400'
                      : 'bg-white dark:bg-gray-700 border-gray-200 dark:border-gray-600 text-gray-700 dark:text-gray-300'
                  }`}
                >
                  <span>{emoji}</span>
                  <span className="font-medium">{users.length}</span>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
