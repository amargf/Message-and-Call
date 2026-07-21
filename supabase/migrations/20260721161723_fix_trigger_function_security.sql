/*
# Fix Security Audit Findings on Trigger Functions

## Overview
Addresses 4 security audit warnings:
1. Function `handle_new_user` has a mutable search_path (search_path hijack risk)
2. Function `update_chat_last_message_at` has a mutable search_path (search_path hijack risk)
3. `handle_new_user` (SECURITY DEFINER) is callable by `anon` via REST RPC
4. `handle_new_user` (SECURITY DEFINER) is callable by `authenticated` via REST RPC

## Changes
- Both functions: pinned `search_path = public, pg_temp` so unqualified object
  references cannot be hijacked by a malicious schema earlier in the path.
- Both functions: qualified all table references with `public.` schema explicitly.
- `handle_new_user`: revoked EXECUTE from `anon`, `authenticated`, and `public`
  so it cannot be invoked directly via `/rest/v1/rpc/handle_new_user`. It is only
  meant to run as a trigger on `auth.users` INSERT during signup.
- `update_chat_last_message_at`: revoked EXECUTE from `anon`, `authenticated`,
  and `public` so it cannot be invoked directly via RPC. It is only meant to run
  as a trigger on `messages` INSERT.

## Notes
- Triggers continue to work normally. Trigger execution is handled internally by
  the database engine and does NOT check the EXECUTE privilege on the function,
  so revoking EXECUTE does not break trigger invocation.
- `handle_new_user` remains SECURITY DEFINER intentionally: it fires during
  `auth.signUp()` when the caller is the `anon` role, which cannot INSERT into
  `profiles` under RLS (the insert policy requires `auth.uid() = id`). Running
  as the owner bypasses RLS so the profile row is created. Revoking EXECUTE
  closes the RPC attack surface while preserving this behavior.
- `CREATE OR REPLACE FUNCTION` preserves the existing trigger bindings — no
  triggers need to be recreated.
*/

-- ============= handle_new_user =============
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, username, full_name)
  VALUES (
    NEW.id,
    split_part(NEW.email, '@', 1),
    split_part(NEW.email, '@', 1)
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp;

REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM anon;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM public;

-- ============= update_chat_last_message_at =============
CREATE OR REPLACE FUNCTION public.update_chat_last_message_at()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE public.chats SET last_message_at = NEW.created_at WHERE id = NEW.chat_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql
SET search_path = public, pg_temp;

REVOKE EXECUTE ON FUNCTION public.update_chat_last_message_at() FROM anon;
REVOKE EXECUTE ON FUNCTION public.update_chat_last_message_at() FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.update_chat_last_message_at() FROM public;
