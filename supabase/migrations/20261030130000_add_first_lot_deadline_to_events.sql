-- DataRun: official close date of the first lot, maintained per event.

alter table public.events
  add column if not exists first_lot_ends_on date;

comment on column public.events.first_lot_ends_on is
  'Official final day of the first registration lot, used as a reference marker in correlation charts.';
