-- DataRun: schema for registration files exported by the event platform.
-- Source analysed: "Registro Etapa Outono" (Apple Numbers), 32 registration columns.

create extension if not exists pgcrypto;

create table public.events (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  edition_year smallint not null check (edition_year between 2000 and 2100),
  source_stage text,
  event_date date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (edition_year, source_stage)
);

create table public.registration_imports (
  id uuid primary key default gen_random_uuid(),
  -- A file may contain registrations from more than one event stage.
  event_id uuid references public.events(id) on delete restrict,
  source_file_name text not null,
  source_file_checksum text,
  imported_by uuid references auth.users(id) on delete set null,
  status text not null default 'pending'
    check (status in ('pending', 'processing', 'completed', 'completed_with_errors', 'failed')),
  source_record_count integer not null default 0 check (source_record_count >= 0),
  inserted_record_count integer not null default 0 check (inserted_record_count >= 0),
  updated_record_count integer not null default 0 check (updated_record_count >= 0),
  error_details jsonb not null default '[]'::jsonb,
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now()
);

create table public.event_registrations (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete restrict,
  latest_import_id uuid references public.registration_imports(id) on delete set null,
  source_row_number integer check (source_row_number > 0),

  -- Identifiers and event origin
  source_year smallint not null check (source_year between 2000 and 2100),
  source_stage text not null,
  external_registration_id bigint not null,
  external_purchase_id bigint,

  -- Purchase and registration details
  lot_name text,
  kit_name text,
  list_price numeric(12, 2) check (list_price >= 0),
  registered_on date not null,
  is_credentialed boolean not null default false,
  credentialed_at timestamp without time zone,
  discount_coupon text,
  discount_amount numeric(12, 2) not null default 0 check (discount_amount >= 0),
  final_amount numeric(12, 2) not null check (final_amount >= 0),
  registration_status text not null,
  purchase_status text not null,
  marketing_opt_in boolean not null default false,
  other_information text,
  source_updated_on date,

  -- Participant information present in the source file
  city text,
  birth_date date,
  discount_type text,
  route_name text,
  shirt_size text,
  kit_pickup_location text,
  terms_accepted boolean not null default false,
  participation_profile text,
  participation_reason text,
  favorite_event_feature text,

  -- Attribution and campaign data
  affiliate_code text,
  utm_source text,
  utm_medium text,
  utm_campaign text,

  -- Keeps unmapped future source fields without altering the historical file.
  source_payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  unique (event_id, external_registration_id)
);

create index event_registrations_event_registered_on_idx
  on public.event_registrations (event_id, registered_on);

create index event_registrations_event_status_idx
  on public.event_registrations (event_id, registration_status, purchase_status);

create index event_registrations_event_utm_idx
  on public.event_registrations (event_id, utm_source, utm_medium, utm_campaign);

create index event_registrations_purchase_idx
  on public.event_registrations (external_purchase_id);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger events_set_updated_at
before update on public.events
for each row execute function public.set_updated_at();

create trigger event_registrations_set_updated_at
before update on public.event_registrations
for each row execute function public.set_updated_at();

alter table public.events enable row level security;
alter table public.registration_imports enable row level security;
alter table public.event_registrations enable row level security;

comment on table public.events is 'Event editions available in the DataRun dashboard.';
comment on table public.registration_imports is 'Audit log for each registration file import.';
comment on table public.event_registrations is 'Registration records imported from the event platform.';
