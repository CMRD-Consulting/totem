-- oauth_states — server-side cache for OAuth `state` round-trips. Replaces
-- the v0 pattern of stuffing the user JWT into a base64'd JSON state param,
-- which exposed the JWT through Spotify's redirect URL (browser history,
-- URL logging, etc.).
--
-- New flow:
--   oauth-start  : generates a random token, INSERTs (token, jwt, playlist_id),
--                  redirects to Spotify with state=<token>
--   oauth-callback: looks up the row by token, uses the stored jwt, DELETEs
--                  the row to make the token single-use
--
-- RLS is enabled but no policies exist — only the service-role client
-- (edge functions) touches this table. Direct client SELECT or INSERT is
-- denied by default-deny, which is what we want.
--
-- Rows expire after 10 minutes (enforced application-side; rows older than
-- that are rejected by oauth-callback and swept by oauth-start on next run).

create table public.oauth_states (
  state_token text primary key,
  jwt text not null,
  playlist_id uuid references public.playlists(id) on delete cascade,
  created_at timestamptz not null default now()
);

create index oauth_states_created_at_idx on public.oauth_states (created_at);

alter table public.oauth_states enable row level security;
-- Intentionally no policies — only service role accesses.
