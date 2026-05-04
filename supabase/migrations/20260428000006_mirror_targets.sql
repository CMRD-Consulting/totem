create table public.mirror_targets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  playlist_id uuid not null references public.playlists(id) on delete cascade,
  service public.music_service not null,
  native_playlist_id text not null,
  enabled boolean not null default true,
  last_synced_at timestamptz,
  last_sync_error text,
  created_at timestamptz not null default now(),
  unique (user_id, playlist_id, service)
);

create index mirror_targets_playlist_idx on public.mirror_targets(playlist_id);

create table public.mirror_track_errors (
  id uuid primary key default gen_random_uuid(),
  mirror_target_id uuid not null references public.mirror_targets(id) on delete cascade,
  track_id uuid not null references public.tracks(id) on delete cascade,
  error_type text not null,
  occurred_at timestamptz not null default now()
);

alter table public.mirror_targets enable row level security;
alter table public.mirror_track_errors enable row level security;

create policy "user manages own mirror_targets"
  on public.mirror_targets for all
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy "user reads own mirror_track_errors"
  on public.mirror_track_errors for select
  using (exists (
    select 1 from public.mirror_targets mt
    where mt.id = mirror_track_errors.mirror_target_id and mt.user_id = auth.uid()
  ));
-- INSERT into mirror_track_errors only via service_role (Edge Function).
