alter table public.oauth_states
  add column if not exists service public.music_service not null default 'spotify';
