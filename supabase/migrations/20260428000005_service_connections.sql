create type public.music_service as enum ('spotify', 'apple_music', 'youtube_music');

create table public.service_connections (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  service public.music_service not null,
  access_token text not null,        -- to be encrypted at app layer; pgsodium key rotation in v1
  refresh_token text,
  expires_at timestamptz not null,
  service_user_id text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, service)
);

alter table public.service_connections enable row level security;

create policy "user reads own connections"
  on public.service_connections for select using (user_id = auth.uid());

create policy "user updates own connections"
  on public.service_connections for update
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy "user deletes own connections"
  on public.service_connections for delete using (user_id = auth.uid());

create policy "user inserts own connections"
  on public.service_connections for insert with check (user_id = auth.uid());
