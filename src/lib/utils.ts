import type { Profile } from '@/types';

const AVATAR_COLORS = [
  'bg-rose-500',
  'bg-pink-500',
  'bg-fuchsia-500',
  'bg-red-500',
  'bg-orange-500',
  'bg-amber-500',
  'bg-yellow-500',
  'bg-lime-500',
  'bg-green-500',
  'bg-emerald-500',
  'bg-teal-500',
  'bg-cyan-500',
  'bg-sky-500',
  'bg-blue-500',
  'bg-indigo-500',
  'bg-violet-500',
];

export function colorFromString(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

export function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) {
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  }
  return name.slice(0, 2).toUpperCase();
}

export function displayName(profile: Profile | null | undefined): string {
  if (!profile) return 'Unknown';
  return profile.full_name || profile.username || 'Unknown';
}

export function formatTime(iso: string): string {
  const date = new Date(iso);
  const now = new Date();
  const isToday = date.toDateString() === now.toDateString();
  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  const isYesterday = date.toDateString() === yesterday.toDateString();

  const time = date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });

  if (isToday) return time;
  if (isYesterday) return `Yesterday ${time}`;
  const days = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));
  if (days < 7) return `${date.toLocaleDateString([], { weekday: 'short' })} ${time}`;
  return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
}

export function formatShortTime(iso: string): string {
  const date = new Date(iso);
  return date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
}

export function formatDateSeparator(iso: string): string {
  const date = new Date(iso);
  const now = new Date();
  const isToday = date.toDateString() === now.toDateString();
  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  const isYesterday = date.toDateString() === yesterday.toDateString();

  if (isToday) return 'Today';
  if (isYesterday) return 'Yesterday';
  return date.toLocaleDateString([], { weekday: 'long', month: 'long', day: 'numeric' });
}

export function formatLastSeen(iso: string, isOnline: boolean): string {
  if (isOnline) return 'Active now';
  const date = new Date(iso);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  const diffHrs = Math.floor(diffMin / 60);
  const diffDays = Math.floor(diffHrs / 24);

  if (diffMin < 1) return 'Just now';
  if (diffMin < 60) return `Active ${diffMin}m ago`;
  if (diffHrs < 24) return `Active ${diffHrs}h ago`;
  if (diffDays < 7) return `Active ${diffDays}d ago`;
  return `Active ${date.toLocaleDateString([], { month: 'short', day: 'numeric' })}`;
}

export function groupMessagesByDate<T extends { created_at: string }>(messages: T[]): T[][] {
  const groups: T[][] = [];
  let currentGroup: T[] = [];
  let currentDate = '';

  for (const msg of messages) {
    const date = new Date(msg.created_at).toDateString();
    if (date !== currentDate) {
      if (currentGroup.length > 0) groups.push(currentGroup);
      currentGroup = [msg];
      currentDate = date;
    } else {
      currentGroup.push(msg);
    }
  }
  if (currentGroup.length > 0) groups.push(currentGroup);
  return groups;
}

export function getChatDisplayName(chat: {
  is_group: boolean;
  name: string | null;
  other_member?: Profile | null;
}): string {
  if (chat.is_group) return chat.name || 'Group Chat';
  return displayName(chat.other_member);
}

export function getChatAvatar(chat: {
  is_group: boolean;
  avatar_url: string | null;
  other_member?: Profile | null;
}): string | null {
  if (chat.is_group) return chat.avatar_url;
  return chat.other_member?.avatar_url ?? null;
}

export function getChatAvatarFallback(chat: {
  is_group: boolean;
  name: string | null;
  other_member?: Profile | null;
}): string {
  if (chat.is_group) return chat.name || 'G';
  return getInitials(displayName(chat.other_member));
}
