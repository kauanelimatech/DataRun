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

type SuggestedPostRow = {
  post_id: string;
  category_id: string;
  confidence: number | string | null;
  source: string;
  instagram_posts: {
    id: string;
    caption: string | null;
    permalink: string | null;
    published_at: string;
    media_type: string;
  } | Array<{
    id: string;
    caption: string | null;
    permalink: string | null;
    published_at: string;
    media_type: string;
  }> | null;
  content_categories: {
    id: string;
    name: string;
    slug: string;
  } | Array<{
    id: string;
    name: string;
    slug: string;
  }> | null;
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

export type InstagramReviewCategory = {
  id: string;
  name: string;
};

export type InstagramSuggestedPost = {
  postId: string;
  caption: string | null;
  permalink: string | null;
  publishedAt: string;
  mediaType: string;
  suggestedCategories: Array<{
    id: string;
    name: string;
    confidence: number | null;
  }>;
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

export async function getInstagramReviewQueue(limit = 24) {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("instagram_post_categories")
    .select("post_id, category_id, confidence, source, instagram_posts!inner(id, caption, permalink, published_at, media_type), content_categories!inner(id, name, slug)")
    .eq("review_status", "suggested")
    .order("created_at", { ascending: true })
    .limit(limit * 4);

  if (error) throw new Error("Não foi possível carregar as sugestões de categoria.");

  const posts = new Map<string, InstagramSuggestedPost>();
  ((data ?? []) as SuggestedPostRow[]).forEach((row) => {
    const post = Array.isArray(row.instagram_posts) ? row.instagram_posts[0] : row.instagram_posts;
    const category = Array.isArray(row.content_categories) ? row.content_categories[0] : row.content_categories;
    if (!post || !category) return;
    const confidence = typeof row.confidence === "number" ? row.confidence : Number(row.confidence);
    const current = posts.get(row.post_id) ?? {
      postId: row.post_id,
      caption: post.caption,
      permalink: post.permalink,
      publishedAt: post.published_at,
      mediaType: post.media_type,
      suggestedCategories: [],
    } satisfies InstagramSuggestedPost;
    current.suggestedCategories.push({
      id: row.category_id,
      name: category.name,
      confidence: Number.isFinite(confidence) ? confidence : null,
    });
    posts.set(row.post_id, current);
  });

  return Array.from(posts.values())
    .map((post) => ({
      ...post,
      suggestedCategories: post.suggestedCategories.sort((left, right) => (right.confidence ?? 0) - (left.confidence ?? 0)),
    }))
    .slice(0, limit);
}

export async function getInstagramReviewCategories(): Promise<InstagramReviewCategory[]> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("content_categories")
    .select("id, name")
    .eq("is_active", true)
    .order("display_order");

  if (error) throw new Error("Não foi possível carregar as categorias de revisão.");
  return (data ?? []) as InstagramReviewCategory[];
}
