-- device_tokens: one row per (user, device-token). Used by send-push to look
-- up which APNs/FCM tokens to deliver a push to when a track lands in a
-- playlist a user is a member of.
--
-- Composite PK on (user_id, token) makes upsert-on-rotation a single statement
-- and rules out double-registering the same token for a user.

create table public.device_tokens (
  user_id uuid not null references public.profiles(id) on delete cascade,
  token text not null,
  platform text not null check (platform in ('ios', 'android', 'web')),
  created_at timestamptz not null default now(),
  primary key (user_id, token)
);

create index device_tokens_user_idx on public.device_tokens(user_id);

alter table public.device_tokens enable row level security;

create policy "users manage own device_tokens"
  on public.device_tokens for all
  using (user_id = auth.uid())
  with check (user_id = auth.uid());
