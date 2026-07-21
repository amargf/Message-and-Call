/*
# Messenger App - Core Schema

## Overview
Creates the complete database schema for a Messenger-like chat application
with real-time messaging, group chats, emoji reactions, read receipts,
typing indicators, and user profiles. Uses Supabase Auth for user management.

## New Tables
1. `profiles` - User profiles extending auth.users (id, username, full_name, avatar_url, bio, last_seen, created_at)
2. `chats` - Conversations: 1-on-1 or group (id, is_group, name, avatar_url, created_by, created_at, last_message_at)
3. `chat_members` - Chat participants junction (chat_id, user_id, role, joined_at)
4. `messages` - Chat messages (id, chat_id, sender_id, content, attachment_url, reply_to_id, edited_at, deleted_at, created_at)
5. `message_reads` - Read receipts (message_id, user_id, read_at)
6. `reactions` - Emoji reactions (id, message_id, user_id, emoji, created_at, unique triplet)

## Triggers
- handle_new_user: auto-create profile on auth.users INSERT
- update_chat_last_message_at: update chats.last_message_at on message INSERT

## Realtime
- All tables added to supabase_realtime publication

## Security (RLS)
- profiles: all authenticated read; owner insert/update/delete
- chats: members read; creator insert; admin update/delete
- chat_members: members read; self/admin insert/update/delete
- messages: chat members read; members send; sender edit/delete own
- message_reads: members read; self insert/delete
- reactions: members read; self insert/delete
*/

-- ============= TABLES (all created first) =============
CREATE TABLE IF NOT EXISTS profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  username text UNIQUE NOT NULL,
  full_name text NOT NULL,
  avatar_url text,
  bio text,
  last_seen timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS chats (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  is_group boolean NOT NULL DEFAULT false,
  name text,
  avatar_url text,
  created_by uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  last_message_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS chat_members (
  chat_id uuid NOT NULL REFERENCES chats(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  role text NOT NULL DEFAULT 'member',
  joined_at timestamptz DEFAULT now(),
  PRIMARY KEY (chat_id, user_id)
);

CREATE TABLE IF NOT EXISTS messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  chat_id uuid NOT NULL REFERENCES chats(id) ON DELETE CASCADE,
  sender_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  content text,
  attachment_url text,
  reply_to_id uuid REFERENCES messages(id) ON DELETE SET NULL,
  edited_at timestamptz,
  deleted_at timestamptz,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS message_reads (
  message_id uuid NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  read_at timestamptz DEFAULT now(),
  PRIMARY KEY (message_id, user_id)
);

CREATE TABLE IF NOT EXISTS reactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id uuid NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  emoji text NOT NULL,
  created_at timestamptz DEFAULT now(),
  UNIQUE (message_id, user_id, emoji)
);

-- ============= RLS ENABLE =============
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE chats ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE message_reads ENABLE ROW LEVEL SECURITY;
ALTER TABLE reactions ENABLE ROW LEVEL SECURITY;

-- ============= PROFILES POLICIES =============
DROP POLICY IF EXISTS "profiles_select_all" ON profiles;
CREATE POLICY "profiles_select_all" ON profiles FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "profiles_insert_own" ON profiles;
CREATE POLICY "profiles_insert_own" ON profiles FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS "profiles_update_own" ON profiles;
CREATE POLICY "profiles_update_own" ON profiles FOR UPDATE TO authenticated USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS "profiles_delete_own" ON profiles;
CREATE POLICY "profiles_delete_own" ON profiles FOR DELETE TO authenticated USING (auth.uid() = id);

-- ============= CHATS POLICIES =============
DROP POLICY IF EXISTS "chats_select_member" ON chats;
CREATE POLICY "chats_select_member" ON chats FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM chat_members WHERE chat_members.chat_id = chats.id AND chat_members.user_id = auth.uid()));

DROP POLICY IF EXISTS "chats_insert_any" ON chats;
CREATE POLICY "chats_insert_any" ON chats FOR INSERT TO authenticated WITH CHECK (auth.uid() = created_by);

DROP POLICY IF EXISTS "chats_update_admin" ON chats;
CREATE POLICY "chats_update_admin" ON chats FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM chat_members WHERE chat_members.chat_id = chats.id AND chat_members.user_id = auth.uid() AND chat_members.role = 'admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM chat_members WHERE chat_members.chat_id = chats.id AND chat_members.user_id = auth.uid() AND chat_members.role = 'admin'));

DROP POLICY IF EXISTS "chats_delete_admin" ON chats;
CREATE POLICY "chats_delete_admin" ON chats FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM chat_members WHERE chat_members.chat_id = chats.id AND chat_members.user_id = auth.uid() AND chat_members.role = 'admin'));

-- ============= CHAT_MEMBERS POLICIES =============
DROP POLICY IF EXISTS "members_select_member" ON chat_members;
CREATE POLICY "members_select_member" ON chat_members FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM chat_members cm WHERE cm.chat_id = chat_members.chat_id AND cm.user_id = auth.uid()));

DROP POLICY IF EXISTS "members_insert_self_or_admin" ON chat_members;
CREATE POLICY "members_insert_self_or_admin" ON chat_members FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id OR EXISTS (SELECT 1 FROM chat_members cm WHERE cm.chat_id = chat_members.chat_id AND cm.user_id = auth.uid() AND cm.role = 'admin'));

DROP POLICY IF EXISTS "members_update_self_or_admin" ON chat_members;
CREATE POLICY "members_update_self_or_admin" ON chat_members FOR UPDATE TO authenticated
  USING (auth.uid() = user_id OR EXISTS (SELECT 1 FROM chat_members cm WHERE cm.chat_id = chat_members.chat_id AND cm.user_id = auth.uid() AND cm.role = 'admin'))
  WITH CHECK (auth.uid() = user_id OR EXISTS (SELECT 1 FROM chat_members cm WHERE cm.chat_id = chat_members.chat_id AND cm.user_id = auth.uid() AND cm.role = 'admin'));

DROP POLICY IF EXISTS "members_delete_self_or_admin" ON chat_members;
CREATE POLICY "members_delete_self_or_admin" ON chat_members FOR DELETE TO authenticated
  USING (auth.uid() = user_id OR EXISTS (SELECT 1 FROM chat_members cm WHERE cm.chat_id = chat_members.chat_id AND cm.user_id = auth.uid() AND cm.role = 'admin'));

-- ============= MESSAGES POLICIES =============
DROP POLICY IF EXISTS "messages_select_member" ON messages;
CREATE POLICY "messages_select_member" ON messages FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM chat_members WHERE chat_members.chat_id = messages.chat_id AND chat_members.user_id = auth.uid()));

DROP POLICY IF EXISTS "messages_insert_member" ON messages;
CREATE POLICY "messages_insert_member" ON messages FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = sender_id AND EXISTS (SELECT 1 FROM chat_members WHERE chat_members.chat_id = messages.chat_id AND chat_members.user_id = auth.uid()));

DROP POLICY IF EXISTS "messages_update_sender" ON messages;
CREATE POLICY "messages_update_sender" ON messages FOR UPDATE TO authenticated
  USING (auth.uid() = sender_id) WITH CHECK (auth.uid() = sender_id);

DROP POLICY IF EXISTS "messages_delete_sender" ON messages;
CREATE POLICY "messages_delete_sender" ON messages FOR DELETE TO authenticated USING (auth.uid() = sender_id);

-- ============= MESSAGE_READS POLICIES =============
DROP POLICY IF EXISTS "reads_select_member" ON message_reads;
CREATE POLICY "reads_select_member" ON message_reads FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM chat_members JOIN messages ON messages.id = message_reads.message_id WHERE chat_members.chat_id = messages.chat_id AND chat_members.user_id = auth.uid()));

DROP POLICY IF EXISTS "reads_insert_own" ON message_reads;
CREATE POLICY "reads_insert_own" ON message_reads FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id AND EXISTS (SELECT 1 FROM chat_members JOIN messages ON messages.id = message_reads.message_id WHERE chat_members.chat_id = messages.chat_id AND chat_members.user_id = auth.uid()));

DROP POLICY IF EXISTS "reads_delete_own" ON message_reads;
CREATE POLICY "reads_delete_own" ON message_reads FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- ============= REACTIONS POLICIES =============
DROP POLICY IF EXISTS "reactions_select_member" ON reactions;
CREATE POLICY "reactions_select_member" ON reactions FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM chat_members JOIN messages ON messages.id = reactions.message_id WHERE chat_members.chat_id = messages.chat_id AND chat_members.user_id = auth.uid()));

DROP POLICY IF EXISTS "reactions_insert_own" ON reactions;
CREATE POLICY "reactions_insert_own" ON reactions FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id AND EXISTS (SELECT 1 FROM chat_members JOIN messages ON messages.id = reactions.message_id WHERE chat_members.chat_id = messages.chat_id AND chat_members.user_id = auth.uid()));

DROP POLICY IF EXISTS "reactions_delete_own" ON reactions;
CREATE POLICY "reactions_delete_own" ON reactions FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- ============= INDEXES =============
CREATE INDEX IF NOT EXISTS idx_messages_chat_created ON messages(chat_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_chat_members_user ON chat_members(user_id);
CREATE INDEX IF NOT EXISTS idx_chat_members_chat ON chat_members(chat_id);
CREATE INDEX IF NOT EXISTS idx_reactions_message ON reactions(message_id);
CREATE INDEX IF NOT EXISTS idx_message_reads_message ON message_reads(message_id);
CREATE INDEX IF NOT EXISTS idx_message_reads_user ON message_reads(user_id);
CREATE INDEX IF NOT EXISTS idx_profiles_username ON profiles(username);

-- ============= TRIGGERS =============
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, username, full_name)
  VALUES (NEW.id, split_part(NEW.email, '@', 1), split_part(NEW.email, '@', 1));
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

CREATE OR REPLACE FUNCTION public.update_chat_last_message_at()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE chats SET last_message_at = NEW.created_at WHERE id = NEW.chat_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS on_message_inserted ON messages;
CREATE TRIGGER on_message_inserted
  AFTER INSERT ON messages
  FOR EACH ROW EXECUTE FUNCTION public.update_chat_last_message_at();

-- ============= REALTIME =============
ALTER PUBLICATION supabase_realtime ADD TABLE messages;
ALTER PUBLICATION supabase_realtime ADD TABLE chats;
ALTER PUBLICATION supabase_realtime ADD TABLE chat_members;
ALTER PUBLICATION supabase_realtime ADD TABLE reactions;
ALTER PUBLICATION supabase_realtime ADD TABLE message_reads;
ALTER PUBLICATION supabase_realtime ADD TABLE profiles;
