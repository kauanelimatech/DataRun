import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";

type CategoryRow = {
  id: string;
  slug: string;
  name: string;
  display_order: number;
};

type PostCategoryRow = {
  category_id: string;
  review_status: string;
};

type ConnectionRow = {
  instagram_username: string | null;
  status: string;
  last_synced_at: string | null;
};

export type InstagramCategorySummary = {
  id: string;
  slug: string;
  name: string;
  confirmedPosts: number;
  suggestedPosts: number;
};

export type InstagramContentSummary = {
  postCount: number;
  categories: InstagramCategorySummary[];
  connection: {
    username: string | null;
    status: string;
    lastSyncedAt: string | null;
  } | null;
};

export async function getInstagramContentSummary(): Promise<InstagramContentSummary> {
  const admin = createAdminClient();
  const [{ data: categories, error: categoriesError }, { data: postCategories, error: postCategoriesError }, { count: postCount, error: postsError }, { data: connection, error: connectionError }] = await Promise.all([
    admin.from("content_categories").select("id, slug, name, display_order").eq("is_active", true).order("display_order"),
    admin.from("instagram_post_categories").select("category_id, review_status"),
    admin.from("instagram_posts").select("id", { count: "exact", head: true }),
    admin.from("instagram_connections").select("instagram_username, status, last_synced_at").order("connected_at", { ascending: false }).limit(1).maybeSingle(),
  ]);

  if (categoriesError || postCategoriesError || postsError || connectionError) {
    throw new Error("Não foi possível carregar a taxonomia de conteúdo do Instagram.");
  }

  const assignments = (postCategories ?? []) as PostCategoryRow[];
  const summaries = ((categories ?? []) as CategoryRow[]).map((category) => ({
    id: category.id,
    slug: category.slug,
    name: category.name,
    confirmedPosts: assignments.filter((assignment) => assignment.category_id === category.id && assignment.review_status === "confirmed").length,
    suggestedPosts: assignments.filter((assignment) => assignment.category_id === category.id && assignment.review_status === "suggested").length,
  }));

  const connectionRow = connection as ConnectionRow | null;
  return {
    postCount: postCount ?? 0,
    categories: summaries,
    connection: connectionRow ? {
      username: connectionRow.instagram_username,
      status: connectionRow.status,
      lastSyncedAt: connectionRow.last_synced_at,
    } : null,
  };
}
