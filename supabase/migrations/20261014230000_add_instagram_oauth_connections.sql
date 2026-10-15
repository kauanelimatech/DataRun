-- DataRun: server-managed OAuth connections and synchronization audit for Instagram.

create table public.instagram_connections (
  id uuid primary key default gen_random_uuid(),
  instagram_user_id text not null unique,
  instagram_username text,
  access_token_encrypted text not null,
  token_expires_at timestamptz,
  granted_scopes text[] not null default '{}'::text[],
  status text not null default 'connected'
    check (status in ('connected', 'error', 'disconnected')),
  connected_by uuid references auth.users(id) on delete set null,
  connected_at timestamptz not null default now(),
  last_synced_at timestamptz,
  last_sync_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.instagram_sync_runs (
  id uuid primary key default gen_random_uuid(),
  connection_id uuid not null references public.instagram_connections(id) on delete cascade,
  triggered_by uuid references auth.users(id) on delete set null,
  status text not null default 'processing'
    check (status in ('processing', 'completed', 'completed_with_errors', 'failed')),
  imported_post_count integer not null default 0 check (imported_post_count >= 0),
  imported_metric_snapshot_count integer not null default 0 check (imported_metric_snapshot_count >= 0),
  error_details jsonb not null default '[]'::jsonb,
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  created_at timestamptz not null default now()
);

create index instagram_sync_runs_connection_created_idx
  on public.instagram_sync_runs (connection_id, created_at desc);

create trigger instagram_connections_set_updated_at
before update on public.instagram_connections
for each row execute function public.set_updated_at();

alter table public.instagram_connections enable row level security;
alter table public.instagram_sync_runs enable row level security;

revoke all on table public.instagram_connections from anon, authenticated;
revoke all on table public.instagram_sync_runs from anon, authenticated;

comment on table public.instagram_connections is 'Encrypted Instagram OAuth tokens. Accessible only through DataRun server routes.';
comment on table public.instagram_sync_runs is 'Audit history of Instagram collection jobs.';
