-- DataRun: Instagram content taxonomy, metric snapshots and reviewed multi-label classifications.

create table public.content_categories (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9_]+$'),
  name text not null,
  display_order smallint not null check (display_order >= 0),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.instagram_posts (
  id uuid primary key default gen_random_uuid(),
  external_media_id text not null unique,
  permalink text,
  caption text,
  published_at timestamptz not null,
  media_type text not null check (media_type in ('IMAGE', 'VIDEO', 'CAROUSEL_ALBUM', 'REEL', 'STORY', 'UNKNOWN')),
  media_product_type text,
  visual_description text,
  audio_transcript text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.instagram_post_events (
  post_id uuid not null references public.instagram_posts(id) on delete cascade,
  event_id uuid not null references public.events(id) on delete cascade,
  source text not null default 'manual' check (source in ('automatic_rules', 'automatic_ai', 'manual')),
  confidence numeric(4, 3) check (confidence >= 0 and confidence <= 1),
  created_at timestamptz not null default now(),
  primary key (post_id, event_id)
);

create table public.instagram_post_categories (
  post_id uuid not null references public.instagram_posts(id) on delete cascade,
  category_id uuid not null references public.content_categories(id) on delete restrict,
  source text not null check (source in ('automatic_rules', 'automatic_ai', 'manual')),
  confidence numeric(4, 3) check (confidence >= 0 and confidence <= 1),
  review_status text not null default 'suggested' check (review_status in ('suggested', 'confirmed', 'rejected')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (post_id, category_id)
);

create table public.instagram_post_metric_snapshots (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.instagram_posts(id) on delete cascade,
  collected_at timestamptz not null default now(),
  reach integer check (reach >= 0),
  views integer check (views >= 0),
  likes integer check (likes >= 0),
  comments integer check (comments >= 0),
  shares integer check (shares >= 0),
  saves integer check (saves >= 0),
  profile_activity integer check (profile_activity >= 0),
  website_clicks integer check (website_clicks >= 0),
  unique (post_id, collected_at)
);

create table public.instagram_category_keywords (
  id uuid primary key default gen_random_uuid(),
  category_id uuid not null references public.content_categories(id) on delete cascade,
  keyword text not null,
  weight numeric(4, 2) not null default 1 check (weight > 0),
  is_active boolean not null default true,
  unique (category_id, keyword)
);

create index instagram_posts_published_at_idx on public.instagram_posts (published_at desc);
create index instagram_post_categories_category_idx on public.instagram_post_categories (category_id, review_status);
create index instagram_post_events_event_idx on public.instagram_post_events (event_id);
create index instagram_post_metric_snapshots_post_collected_idx on public.instagram_post_metric_snapshots (post_id, collected_at desc);

create trigger content_categories_set_updated_at
before update on public.content_categories
for each row execute function public.set_updated_at();

create trigger instagram_posts_set_updated_at
before update on public.instagram_posts
for each row execute function public.set_updated_at();

create trigger instagram_post_categories_set_updated_at
before update on public.instagram_post_categories
for each row execute function public.set_updated_at();

alter table public.content_categories enable row level security;
alter table public.instagram_posts enable row level security;
alter table public.instagram_post_events enable row level security;
alter table public.instagram_post_categories enable row level security;
alter table public.instagram_post_metric_snapshots enable row level security;
alter table public.instagram_category_keywords enable row level security;

insert into public.content_categories (slug, name, display_order)
values
  ('itens_kit', 'Itens do kit', 1),
  ('lotes_inscricoes', 'Lotes e inscrições', 2),
  ('percurso', 'Percurso', 3),
  ('publicidade', 'Publicidade', 4),
  ('informacoes', 'Informações', 5),
  ('bastidores', 'Bastidores', 6),
  ('produtos_exclusivos', 'Produtos exclusivos', 7),
  ('dump_aftermovie', 'Dump & aftermovie', 8),
  ('outros', 'Outros', 9)
on conflict (slug) do update
set name = excluded.name,
    display_order = excluded.display_order,
    is_active = true;

insert into public.instagram_category_keywords (category_id, keyword, weight)
select category.id, keyword.keyword, keyword.weight
from public.content_categories category
join (
  values
    ('itens_kit', 'kit', 1.4::numeric),
    ('itens_kit', 'camiseta', 1.2::numeric),
    ('itens_kit', 'medalha', 1.2::numeric),
    ('itens_kit', 'sacochila', 1.0::numeric),
    ('lotes_inscricoes', 'inscrição', 1.3::numeric),
    ('lotes_inscricoes', 'lote', 1.3::numeric),
    ('lotes_inscricoes', 'vagas', 1.1::numeric),
    ('lotes_inscricoes', 'cupom', 1.1::numeric),
    ('lotes_inscricoes', 'virada', 1.0::numeric),
    ('percurso', 'percurso', 1.4::numeric),
    ('percurso', 'trajeto', 1.2::numeric),
    ('percurso', 'altimetria', 1.2::numeric),
    ('percurso', 'mapa', 1.0::numeric),
    ('publicidade', 'patrocinador', 1.3::numeric),
    ('publicidade', 'parceiro', 1.2::numeric),
    ('publicidade', 'apoio', 1.0::numeric),
    ('publicidade', 'publicidade', 1.2::numeric),
    ('informacoes', 'regulamento', 1.3::numeric),
    ('informacoes', 'retirada', 1.1::numeric),
    ('informacoes', 'horário', 1.0::numeric),
    ('informacoes', 'local', 0.8::numeric),
    ('bastidores', 'bastidores', 1.3::numeric),
    ('bastidores', 'montagem', 1.1::numeric),
    ('bastidores', 'equipe', 0.9::numeric),
    ('produtos_exclusivos', 'exclusivo', 1.2::numeric),
    ('produtos_exclusivos', 'coleção', 1.0::numeric),
    ('produtos_exclusivos', 'produto', 0.9::numeric),
    ('dump_aftermovie', 'dump', 1.3::numeric),
    ('dump_aftermovie', 'aftermovie', 1.4::numeric),
    ('dump_aftermovie', 'melhores momentos', 1.2::numeric),
    ('dump_aftermovie', 'pós-prova', 1.1::numeric)
) as keyword(category_slug, keyword, weight)
  on category.slug = keyword.category_slug
on conflict (category_id, keyword) do update
set weight = excluded.weight,
    is_active = true;

comment on table public.content_categories is 'Editorial taxonomy maintained by DataRun for Instagram content analysis.';
comment on table public.instagram_post_categories is 'Multiple reviewed category assignments for each Instagram post.';
comment on table public.instagram_post_metric_snapshots is 'Time-stamped public performance metrics collected from the Instagram API.';
