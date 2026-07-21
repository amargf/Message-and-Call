export interface Profile {
  id: string;
  username: string;
  full_name: string;
  avatar_url: string | null;
  bio: string | null;
  last_seen: string;
  created_at: string;
}

export interface Chat {
  id: string;
  is_group: boolean;
  name: string | null;
  avatar_url: string | null;
  created_by: string;
  created_at: string;
  last_message_at: string;
}

export interface ChatMember {
  chat_id: string;
  user_id: string;
  role: string;
  joined_at: string;
  profile?: Profile;
}

export interface Reaction {
  id: string;
  message_id: string;
  user_id: string;
  emoji: string;
  created_at: string;
}

export interface MessageRead {
  message_id: string;
  user_id: string;
  read_at: string;
}

export interface Message {
  id: string;
  chat_id: string;
  sender_id: string;
  content: string | null;
  attachment_url: string | null;
  reply_to_id: string | null;
  edited_at: string | null;
  deleted_at: string | null;
  created_at: string;
  sender?: Profile;
  reply_to?: Message | null;
  reactions?: Reaction[];
  reads?: MessageRead[];
}

export interface ChatWithDetails extends Chat {
  members?: ChatMember[];
  last_message?: Message | null;
  other_member?: Profile | null;
  unread_count?: number;
}

export interface PresenceState {
  user_id: string;
  online_at: string;
}
