/*
# Fix RLS Recursion on chat_members Policies

## Problem
The chat_members, chats, messages, message_reads, and reactions RLS policies
all use `EXISTS (SELECT 1 FROM chat_members WHERE ...)` to check membership.
Since those subqueries are themselves subject to RLS on chat_members (which
also does an EXISTS on chat_members...), PostgreSQL hits infinite recursion
and silently returns no rows. Result: chats never appear, members can't be
added, messages can't be sent.

## Fix
Create two SECURITY DEFINER helper functions that bypass RLS to check
membership, and use them in every policy that previously subqueried
chat_members. This breaks the recursion completely.

- is_chat_member(chat_uuid, user_uuid) -> boolean
- is_chat_admin(chat_uuid, user_uuid) -> boolean

Both are revoked from anon/authenticated/public so they cannot be called via
REST RPC — they are only used internally by RLS policy expressions.
*/

-- ============= HELPER FUNCTIONS (SECURITY DEFINER, bypass RLS) =============
CREATE OR REPLACE FUNCTION public.is_chat_member(chat_uuid uuid, user_uuid uuid)
RETURNS boolean AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.chat_members
    WHERE chat_id = chat_uuid AND user_id = user_uuid
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp;

CREATE OR REPLACE FUNCTION public.is_chat_admin(chat_uuid uuid, user_uuid uuid)
RETURNS boolean AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.chat_members
    WHERE chat_id = chat_uuid AND user_id = user_uuid AND role = 'admin'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp;

REVOKE EXECUTE ON FUNCTION public.is_chat_member(uuid, uuid) FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.is_chat_admin(uuid, uuid) FROM anon, authenticated, public;

-- ============= CHATS POLICIES (replace recursive subqueries) =============
DROP POLICY IF EXISTS "chats_select_member" ON chats;
CREATE POLICY "chats_select_member" ON chats FOR SELECT TO authenticated
  USING (public.is_chat_member(chats.id, auth.uid()));

DROP POLICY IF EXISTS "chats_insert_any" ON chats;
CREATE POLICY "chats_insert_any" ON chats FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = created_by);

DROP POLICY IF EXISTS "chats_update_admin" ON chats;
CREATE POLICY "chats_update_admin" ON chats FOR UPDATE TO authenticated
  USING (public.is_chat_admin(chats.id, auth.uid()))
  WITH CHECK (public.is_chat_admin(chats.id, auth.uid()));

DROP POLICY IF EXISTS "chats_delete_admin" ON chats;
CREATE POLICY "chats_delete_admin" ON chats FOR DELETE TO authenticated
  USING (public.is_chat_admin(chats.id, auth.uid()));

-- ============= CHAT_MEMBERS POLICIES (replace recursive subqueries) =============
DROP POLICY IF EXISTS "members_select_member" ON chat_members;
CREATE POLICY "members_select_member" ON chat_members FOR SELECT TO authenticated
  USING (public.is_chat_member(chat_members.chat_id, auth.uid()));

DROP POLICY IF EXISTS "members_insert_self_or_admin" ON chat_members;
CREATE POLICY "members_insert_self_or_admin" ON chat_members FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id OR public.is_chat_admin(chat_members.chat_id, auth.uid()));

DROP POLICY IF EXISTS "members_update_self_or_admin" ON chat_members;
CREATE POLICY "members_update_self_or_admin" ON chat_members FOR UPDATE TO authenticated
  USING (auth.uid() = user_id OR public.is_chat_admin(chat_members.chat_id, auth.uid()))
  WITH CHECK (auth.uid() = user_id OR public.is_chat_admin(chat_members.chat_id, auth.uid()));

DROP POLICY IF EXISTS "members_delete_self_or_admin" ON chat_members;
CREATE POLICY "members_delete_self_or_admin" ON chat_members FOR DELETE TO authenticated
  USING (auth.uid() = user_id OR public.is_chat_admin(chat_members.chat_id, auth.uid()));

-- ============= MESSAGES POLICIES (replace recursive subqueries) =============
DROP POLICY IF EXISTS "messages_select_member" ON messages;
CREATE POLICY "messages_select_member" ON messages FOR SELECT TO authenticated
  USING (public.is_chat_member(messages.chat_id, auth.uid()));

DROP POLICY IF EXISTS "messages_insert_member" ON messages;
CREATE POLICY "messages_insert_member" ON messages FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = sender_id AND public.is_chat_member(messages.chat_id, auth.uid()));

DROP POLICY IF EXISTS "messages_update_sender" ON messages;
CREATE POLICY "messages_update_sender" ON messages FOR UPDATE TO authenticated
  USING (auth.uid() = sender_id) WITH CHECK (auth.uid() = sender_id);

DROP POLICY IF EXISTS "messages_delete_sender" ON messages;
CREATE POLICY "messages_delete_sender" ON messages FOR DELETE TO authenticated
  USING (auth.uid() = sender_id);

-- ============= MESSAGE_READS POLICIES (replace recursive subqueries) =============
DROP POLICY IF EXISTS "reads_select_member" ON message_reads;
CREATE POLICY "reads_select_member" ON message_reads FOR SELECT TO authenticated
  USING (public.is_chat_member((SELECT messages.chat_id FROM public.messages WHERE messages.id = message_reads.message_id), auth.uid()));

DROP POLICY IF EXISTS "reads_insert_own" ON message_reads;
CREATE POLICY "reads_insert_own" ON message_reads FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id AND public.is_chat_member((SELECT messages.chat_id FROM public.messages WHERE messages.id = message_reads.message_id), auth.uid()));

DROP POLICY IF EXISTS "reads_delete_own" ON message_reads;
CREATE POLICY "reads_delete_own" ON message_reads FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

-- ============= REACTIONS POLICIES (replace recursive subqueries) =============
DROP POLICY IF EXISTS "reactions_select_member" ON reactions;
CREATE POLICY "reactions_select_member" ON reactions FOR SELECT TO authenticated
  USING (public.is_chat_member((SELECT messages.chat_id FROM public.messages WHERE messages.id = reactions.message_id), auth.uid()));

DROP POLICY IF EXISTS "reactions_insert_own" ON reactions;
CREATE POLICY "reactions_insert_own" ON reactions FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id AND public.is_chat_member((SELECT messages.chat_id FROM public.messages WHERE messages.id = reactions.message_id), auth.uid()));

DROP POLICY IF EXISTS "reactions_delete_own" ON reactions;
CREATE POLICY "reactions_delete_own" ON reactions FOR DELETE TO authenticated
  USING (auth.uid() = user_id);
