begin;
select plan(3);

-- A profile row should be auto-created when a user signs up.
insert into auth.users (id, email)
values ('00000000-0000-0000-0000-000000000001', 'alice@example.com');

select is(
  (select count(*) from public.profiles where id = '00000000-0000-0000-0000-000000000001'),
  1::bigint,
  'profile auto-created on auth.users insert'
);

select is(
  (select display_name from public.profiles where id = '00000000-0000-0000-0000-000000000001'),
  'alice',
  'display_name defaults to email local-part if no metadata'
);

-- Profiles policy: an authenticated user can read their own profile only.
set local role authenticated;
set local request.jwt.claim.sub = '00000000-0000-0000-0000-000000000001';
select is(
  (select count(*) from public.profiles),
  1::bigint,
  'authenticated user can SELECT their own profile via RLS'
);

select * from finish();
rollback;
