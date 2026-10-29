-- DataRun: managed dashboard access with administrator and read-only organizer roles.

create table if not exists public.datarun_user_profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  role text not null default 'ORGANIZER'
    check (role in ('ADMINISTRATOR', 'ORGANIZER')),
  must_set_password boolean not null default true,
  invited_at timestamptz,
  password_reset_at timestamptz,
  password_set_at timestamptz,
  access_link_created_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists datarun_user_profiles_role_idx
  on public.datarun_user_profiles (role);

create or replace function public.create_datarun_user_profile()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.datarun_user_profiles (id, email, role, must_set_password, invited_at)
  values (new.id, new.email, 'ORGANIZER', true, now())
  on conflict (id) do update
    set email = excluded.email,
        updated_at = now();
  return new;
end;
$$;

drop trigger if exists datarun_user_profiles_on_auth_user_created on auth.users;

create trigger datarun_user_profiles_on_auth_user_created
after insert on auth.users
for each row execute function public.create_datarun_user_profile();

-- Bring the already-authorized account into the managed access model. Existing
-- accounts keep their current password and the earliest account becomes the
-- initial administrator only when no administrator exists yet.
insert into public.datarun_user_profiles (id, email, role, must_set_password, password_set_at)
select id, email, 'ORGANIZER', false, now()
from auth.users
where email is not null
on conflict (id) do update
  set email = excluded.email,
      updated_at = now();

do $$
declare
  initial_user_id uuid;
begin
  if not exists (
    select 1
    from public.datarun_user_profiles
    where role = 'ADMINISTRATOR'
  ) then
    select id
      into initial_user_id
      from auth.users
     where email is not null
     order by created_at asc
     limit 1;

    if initial_user_id is not null then
      update public.datarun_user_profiles
         set role = 'ADMINISTRATOR',
             must_set_password = false,
             password_set_at = coalesce(password_set_at, now()),
             updated_at = now()
       where id = initial_user_id;
    end if;
  end if;
end;
$$;

create trigger datarun_user_profiles_set_updated_at
before update on public.datarun_user_profiles
for each row execute function public.set_updated_at();

alter table public.datarun_user_profiles enable row level security;

revoke all on table public.datarun_user_profiles from anon;
revoke insert, update, delete on table public.datarun_user_profiles from authenticated;
grant select on table public.datarun_user_profiles to authenticated;

drop policy if exists "Users can read their own DataRun access profile" on public.datarun_user_profiles;

create policy "Users can read their own DataRun access profile"
on public.datarun_user_profiles
for select
to authenticated
using ((select auth.uid()) = id);

comment on table public.datarun_user_profiles is 'Access roles for the DataRun dashboard. Managed only by server-side administrator routes.';
comment on column public.datarun_user_profiles.must_set_password is 'Forces the authenticated user to define a password before entering the dashboard.';
