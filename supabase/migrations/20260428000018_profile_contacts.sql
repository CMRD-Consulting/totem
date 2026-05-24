-- profile_contacts — sensitive contact data, separated from public-ish
-- profiles. Strict self-only RLS so co-members of a shared playlist can't
-- read each other's email/phone (the profiles policy from
-- 20260428000017_profiles_shared_playlist_rls.sql allows shared reads).
--
-- Email is auto-populated from auth.users on signup and synced on auth
-- updates. Phone is always user-entered (no auth provider gives it on signup).
-- Both nullable — Apple "Hide My Email" + email-OTP-only signups still work.
--
-- Indexes prepared for future "invite by email/phone" lookups, which must
-- live behind a security definer RPC (direct client SELECT would be a user
-- enumeration vector).

create table public.profile_contacts (
  user_id uuid primary key references auth.users(id) on delete cascade,
  email text,
  phone text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Partial unique on email so multiple NULLs are allowed (a user without
-- email shouldn't block other null-email users). Mirrors auth.users.email
-- uniqueness for the rows where it exists.
create unique index profile_contacts_email_unique
  on public.profile_contacts (email)
  where email is not null;

-- Phone isn't a uniqueness key — two people might legitimately enter the
-- same number (typo, shared device). Plain index for lookup.
create index profile_contacts_phone_idx
  on public.profile_contacts (phone)
  where phone is not null;

alter table public.profile_contacts enable row level security;

create policy "users read own contacts"
  on public.profile_contacts for select
  using (user_id = auth.uid());

create policy "users update own contacts"
  on public.profile_contacts for update
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- No client-side INSERT policy — the trigger below (security definer)
-- handles inserts. No client-side DELETE either; cascades from auth.users.

-- Extend the existing handle_new_user trigger to also create a contacts row.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  derived_name text;
begin
  derived_name := coalesce(
    new.raw_user_meta_data ->> 'full_name',
    new.raw_user_meta_data ->> 'name',
    split_part(new.email, '@', 1),
    'User'
  );
  insert into public.profiles (id, display_name) values (new.id, derived_name);
  insert into public.profile_contacts (user_id, email, phone)
    values (new.id, new.email, new.phone);
  return new;
end;
$$;

-- Sync email/phone whenever auth.users changes them (e.g. user updates
-- email via Supabase recovery, or admin updates phone). The OF clause
-- limits trigger firing to those two columns specifically.
create function public.sync_user_contact()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.profile_contacts
  set
    email = new.email,
    phone = new.phone,
    updated_at = now()
  where user_id = new.id;
  return new;
end;
$$;

create trigger on_auth_user_updated
after update of email, phone on auth.users
for each row execute function public.sync_user_contact();

-- Backfill: every existing auth.users row gets a profile_contacts row.
-- ON CONFLICT guards against re-runs in any maintenance scenario.
insert into public.profile_contacts (user_id, email, phone)
  select id, email, phone from auth.users
  on conflict (user_id) do nothing;
