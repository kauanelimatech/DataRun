-- DataRun: keep only the analytics fields explicitly allowed by the importer.
-- Direct identifiers and unrestricted free-text source fields must never be retained.

create or replace function public.remove_non_analytic_registration_data()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.source_payload = '{}'::jsonb;
  new.birth_date = null;
  new.other_information = null;
  return new;
end;
$$;

drop trigger if exists event_registrations_remove_non_analytic_data on public.event_registrations;

create trigger event_registrations_remove_non_analytic_data
before insert or update on public.event_registrations
for each row execute function public.remove_non_analytic_registration_data();

update public.event_registrations
set
  source_payload = '{}'::jsonb,
  birth_date = null,
  other_information = null
where source_payload <> '{}'::jsonb
   or birth_date is not null
   or other_information is not null;

comment on column public.event_registrations.source_payload is 'Reserved empty field. The importer discards all source columns outside its explicit analytics allowlist.';
comment on column public.event_registrations.birth_date is 'Not retained by DataRun imports to minimize personal data.';
comment on column public.event_registrations.other_information is 'Not retained by DataRun imports because free text may contain personal data.';
