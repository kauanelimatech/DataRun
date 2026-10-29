-- DataRun: replace emailed access links with manually shared, one-time activation codes.

alter table public.datarun_user_profiles
  add column if not exists activation_code_hash text,
  add column if not exists activation_code_created_at timestamptz,
  add column if not exists activation_code_expires_at timestamptz,
  add column if not exists activation_code_used_at timestamptz;

comment on column public.datarun_user_profiles.activation_code_hash is 'HMAC fingerprint of a manually shared activation code. The code itself is never retained.';
comment on column public.datarun_user_profiles.activation_code_expires_at is 'Expiration of the one-time manual activation code.';
