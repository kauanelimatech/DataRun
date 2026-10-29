-- DataRun: identify countdown posts and return previously confirmed information posts to editorial review.

do $$
begin
  if not exists (select 1 from public.content_categories where slug = 'contagem_regressiva') then
    update public.content_categories
       set display_order = display_order + 1
     where display_order >= 6;

    insert into public.content_categories (slug, name, display_order)
    values ('contagem_regressiva', 'Contagem regressiva', 6);
  end if;
end;
$$;

insert into public.instagram_category_keywords (category_id, keyword, weight)
select id, 'contagem regressiva', 1.4::numeric
from public.content_categories
where slug = 'contagem_regressiva'
on conflict (category_id, keyword) do update
set weight = excluded.weight,
    is_active = true;

with countdown_posts as (
  select id
  from public.instagram_posts
  where regexp_replace(lower(coalesce(caption, '')), '[[:space:]]+', ' ', 'g') ~
    '(contagem[[:space:]]+regressiva|faltam?[[:space:]]+[0-9]+[[:space:]]+dias?|((é|e)[[:space:]]+amanh[ãa].*(etapa|prova|corrida|evento))|(amanh[ãa].*(etapa|prova|corrida|evento)))'
), countdown_category as (
  select id from public.content_categories where slug = 'contagem_regressiva'
)
insert into public.instagram_post_categories (post_id, category_id, source, confidence, review_status)
select countdown_posts.id, countdown_category.id, 'automatic_rules', 0.93, 'suggested'
from countdown_posts cross join countdown_category
on conflict (post_id, category_id) do update
set source = case
      when public.instagram_post_categories.review_status = 'confirmed' then public.instagram_post_categories.source
      else excluded.source
    end,
    confidence = case
      when public.instagram_post_categories.review_status = 'confirmed' then public.instagram_post_categories.confidence
      else excluded.confidence
    end,
    review_status = case
      when public.instagram_post_categories.review_status = 'confirmed' then 'confirmed'
      else 'suggested'
    end;

with countdown_posts as (
  select id
  from public.instagram_posts
  where regexp_replace(lower(coalesce(caption, '')), '[[:space:]]+', ' ', 'g') ~
    '(contagem[[:space:]]+regressiva|faltam?[[:space:]]+[0-9]+[[:space:]]+dias?|((é|e)[[:space:]]+amanh[ãa].*(etapa|prova|corrida|evento))|(amanh[ãa].*(etapa|prova|corrida|evento)))'
), information_category as (
  select id from public.content_categories where slug = 'informacoes'
)
update public.instagram_post_categories assignment
   set review_status = 'suggested'
  from countdown_posts, information_category
 where assignment.post_id = countdown_posts.id
   and assignment.category_id = information_category.id
   and assignment.review_status = 'confirmed';

