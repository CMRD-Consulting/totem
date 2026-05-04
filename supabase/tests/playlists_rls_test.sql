begin;
select plan(5);

-- Setup: two users
insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-000000000001', 'alice@example.com'),
  ('00000000-0000-0000-0000-000000000002', 'bob@example.com');

-- Alice creates a playlist
set local role service_role;
insert into public.playlists (id, name, created_by, invite_token)
values ('00000000-0000-0000-0000-000000000010', 'Late Night Vibes',
        '00000000-0000-0000-0000-000000000001', 'token-abc');
insert into public.playlist_members (playlist_id, user_id) values
  ('00000000-0000-0000-0000-000000000010', '00000000-0000-0000-0000-000000000001');

-- Alice (member) can read it
set local role authenticated;
set local request.jwt.claim.sub = '00000000-0000-0000-0000-000000000001';
select is(
  (select count(*) from public.playlists where id = '00000000-0000-0000-0000-000000000010'),
  1::bigint,
  'member can SELECT playlist'
);
select is(
  (select count(*) from public.playlist_members where playlist_id = '00000000-0000-0000-0000-000000000010'),
  1::bigint,
  'member can SELECT membership rows for that playlist'
);

-- Bob (non-member) cannot read it
reset role; reset request.jwt.claim.sub;
set local role authenticated;
set local request.jwt.claim.sub = '00000000-0000-0000-0000-000000000002';
select is(
  (select count(*) from public.playlists where id = '00000000-0000-0000-0000-000000000010'),
  0::bigint,
  'non-member cannot SELECT playlist'
);
select is(
  (select count(*) from public.playlist_members where playlist_id = '00000000-0000-0000-0000-000000000010'),
  0::bigint,
  'non-member cannot SELECT membership rows'
);

-- is_playlist_member helper sanity check
reset role; reset request.jwt.claim.sub;
select is(
  public.is_playlist_member('00000000-0000-0000-0000-000000000010', '00000000-0000-0000-0000-000000000001'),
  true,
  'is_playlist_member returns true for member'
);

select * from finish();
rollback;
