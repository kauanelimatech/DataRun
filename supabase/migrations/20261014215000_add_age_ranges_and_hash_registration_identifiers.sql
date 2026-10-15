-- DataRun: retain age analytics without retaining birth dates, and replace source IDs with HMAC fingerprints.

create table if not exists public.datarun_import_settings (
  singleton boolean primary key default true check (singleton),
  registration_hash_secret text not null,
  created_at timestamptz not null default now()
);

alter table public.datarun_import_settings enable row level security;
revoke all on table public.datarun_import_settings from anon, authenticated;

insert into public.datarun_import_settings (singleton, registration_hash_secret)
values (true, encode(gen_random_bytes(32), 'hex'))
on conflict (singleton) do nothing;

alter table public.event_registrations
  add column if not exists age_range text,
  add column if not exists registration_hash text,
  add column if not exists purchase_hash text;

do $$
declare
  hash_secret text;
begin
  select registration_hash_secret
    into hash_secret
    from public.datarun_import_settings
   where singleton = true;

  update public.event_registrations
     set registration_hash = encode(hmac('registration:' || event_id::text || ':' || external_registration_id::text, hash_secret, 'sha256'), 'hex'),
         purchase_hash = case
           when external_purchase_id is null then null
           else encode(hmac('purchase:' || event_id::text || ':' || external_purchase_id::text, hash_secret, 'sha256'), 'hex')
         end
   where registration_hash is null;
end;
$$;

alter table public.event_registrations
  alter column registration_hash set not null;

alter table public.event_registrations
  drop constraint if exists event_registrations_event_id_external_registration_id_key;

drop index if exists public.event_registrations_purchase_idx;

alter table public.event_registrations
  drop column if exists external_registration_id,
  drop column if exists external_purchase_id;

alter table public.event_registrations
  add constraint event_registrations_event_registration_hash_key unique (event_id, registration_hash);

create index if not exists event_registrations_purchase_hash_idx
  on public.event_registrations (purchase_hash)
  where purchase_hash is not null;

comment on column public.event_registrations.age_range is 'Five-year age band calculated at registration time. Exact birth date is not retained.';
comment on column public.event_registrations.registration_hash is 'HMAC fingerprint of the source registration identifier. Source ID is not retained.';
comment on column public.event_registrations.purchase_hash is 'HMAC fingerprint of the source purchase identifier. Source ID is not retained.';
