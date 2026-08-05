-- Fix feedback + chat logging, which have been silently failing since launch.
--
-- Root causes (diagnosed 2026-08-05 via the app's own anon key):
--   1. feedback_events has no user_session_id / session_id column, but the
--      client sent `user_session_id` on every insert -> PostgREST rejected
--      every request at the schema level (PGRST204).
--   2. Even with correct columns, feedback_events and chat_messages both
--      have Row Level Security enabled with NO insert policy for the
--      `anon` role -> every insert was rejected (42501), including ones
--      that already had the right columns.
--
-- The client code (app.js, chat.js) has been updated to send `session_id`
-- instead of `user_session_id`. This migration adds the matching column
-- and the missing insert policies. Run this in the Supabase SQL editor
-- (or `supabase db push` once this repo is linked) — it is not something
-- this session can execute directly, since only the anon key is available
-- to the app and this session, not a service-role key.

-- 1. Add the session_id column feedback_events was always missing.
alter table public.feedback_events
  add column if not exists session_id text;

-- 2. Allow the app's anon key to insert feedback events.
--    (Postgres has no `create policy if not exists` — drop-then-create
--    is the standard idempotent pattern.)
drop policy if exists "anon can insert feedback_events" on public.feedback_events;
create policy "anon can insert feedback_events"
  on public.feedback_events
  for insert
  to anon
  with check (true);

-- 3. Allow the app's anon key to insert chat message logs.
drop policy if exists "anon can insert chat_messages" on public.chat_messages;
create policy "anon can insert chat_messages"
  on public.chat_messages
  for insert
  to anon
  with check (true);

-- Note: this intentionally does not touch the `feedback` table, which the
-- current app code does not use (it has a different, older shape: session_id,
-- rating, comment — no verdict/source/milestone columns). Leaving it alone
-- pending a decision on whether to drop it.
