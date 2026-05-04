begin;
select plan(4);

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-000000000001', 'alice@example.com'),
  ('00000000-0000-0000-0000-000000000002', 'bob@example.com');

-- Alice creates a playlist
set local role authenticated;
set local request.jwt.claim.sub = '00000000-0000-0000-0000-000000000001';

select isnt(
  (select public.create_playlist('My Mix', 'Test playlist'))::text,
  null,
  'create_playlist returns a row'
);

select is(
  (select count(*) from public.playlists where created_by = '00000000-0000-0000-0000-000000000001'),
  1::bigint,
  'playlist row created by Alice'
);

select is(
  (select count(*) from public.playlist_members where user_id = '00000000-0000-0000-0000-000000000001'),
  1::bigint,
  'Alice auto-added to playlist_members'
);

-- Capture the invite token while Alice (a member) can still read it via RLS
create temp table _t as select invite_token from public.playlists limit 1;

-- Bob joins by invite token
reset role; reset request.jwt.claim.sub;
set local role authenticated;
set local request.jwt.claim.sub = '00000000-0000-0000-0000-000000000002';

select is(
  (select playlist_id is not null from public.join_playlist_by_token((select invite_token from _t))),
  true,
  'join_playlist_by_token returns playlist_id'
);

select * from finish();
rollback;
