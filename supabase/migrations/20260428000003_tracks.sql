create table public.tracks (
  id uuid primary key default gen_random_uuid(),
  isrc text,
  title text not null,
  artist text not null,
  album text,
  artwork_url text,
  duration_ms integer,
  spotify_id text,
  apple_music_id text,
  youtube_music_id text,
  songlink_url text,
  created_at timestamptz not null default now()
);

-- Lookup indices for resolve-or-insert
create unique index tracks_isrc_idx on public.tracks(isrc) where isrc is not null;
create unique index tracks_spotify_idx on public.tracks(spotify_id) where spotify_id is not null;
create unique index tracks_apple_idx on public.tracks(apple_music_id) where apple_music_id is not null;
create unique index tracks_youtube_idx on public.tracks(youtube_music_id) where youtube_music_id is not null;

alter table public.tracks enable row level security;

create policy "any authenticated user can read tracks"
  on public.tracks for select
  to authenticated
  using (true);

-- INSERT/UPDATE only via service_role (Edge Functions). No client policies.
