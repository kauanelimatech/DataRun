-- DataRun: each Instagram post has one final editorial category.
-- Keep the most recently reviewed confirmed category if old data contains duplicates.

with ranked_confirmations as (
  select
    post_id,
    category_id,
    row_number() over (
      partition by post_id
      order by updated_at desc, created_at desc, category_id
    ) as position
  from public.instagram_post_categories
  where review_status = 'confirmed'
)
update public.instagram_post_categories assignment
   set review_status = 'rejected',
       updated_at = now()
  from ranked_confirmations confirmation
 where assignment.post_id = confirmation.post_id
   and assignment.category_id = confirmation.category_id
   and confirmation.position > 1;

create unique index if not exists instagram_post_categories_one_confirmed_category_idx
  on public.instagram_post_categories (post_id)
  where review_status = 'confirmed';

comment on index public.instagram_post_categories_one_confirmed_category_idx is
  'Ensures one final confirmed content category per Instagram post.';
