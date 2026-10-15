import "server-only";

import { suggestContentCategories } from "@/lib/instagram/category-suggestions";
import { createAdminClient } from "@/lib/supabase/admin";

const mediaTypes = ["IMAGE", "VIDEO", "CAROUSEL_ALBUM", "REEL", "STORY", "UNKNOWN"] as const;

export type InstagramMediaType = (typeof mediaTypes)[number];

export type InstagramPostImport = {
  externalMediaId: string;
  permalink?: string | null;
  caption?: string | null;
  publishedAt: string;
  mediaType?: string | null;
  mediaProductType?: string | null;
  visualDescription?: string | null;
  audioTranscript?: string | null;
  eventIds?: string[];
};

export type InstagramMetricSnapshotImport = {
  externalMediaId: string;
  collectedAt: string;
  reach?: number | null;
  views?: number | null;
  likes?: number | null;
  comments?: number | null;
  shares?: number | null;
  saves?: number | null;
  profileActivity?: number | null;
  websiteClicks?: number | null;
};

type CategoryRow = { id: string; slug: string };
type PostRow = { id: string; external_media_id: string };

function normalizeMediaType(value: string | null | undefined): InstagramMediaType {
  const candidate = value?.trim().toUpperCase();
  return mediaTypes.includes(candidate as InstagramMediaType) ? candidate as InstagramMediaType : "UNKNOWN";
}

function asNonNegativeInteger(value: number | null | undefined) {
  if (value === null || value === undefined || !Number.isFinite(value)) return null;
  return Math.max(0, Math.round(value));
}

/**
 * Saves posts obtained from the Instagram connector and adds category suggestions.
 * Existing manual decisions are preserved because suggested assignments only insert
 * when an assignment for the post/category pair does not already exist.
 */
export async function importInstagramPosts(posts: InstagramPostImport[]) {
  if (posts.length === 0) return { importedPosts: 0, suggestedAssignments: 0 };

  const admin = createAdminClient();
  const { data: categoryRows, error: categoriesError } = await admin
    .from("content_categories")
    .select("id, slug")
    .eq("is_active", true);

  if (categoriesError) throw new Error("Não foi possível carregar as categorias de conteúdo.");
  const categoryIdBySlug = new Map(((categoryRows ?? []) as CategoryRow[]).map((category) => [category.slug, category.id]));

  const postRows = posts.map((post) => ({
    external_media_id: post.externalMediaId,
    permalink: post.permalink?.trim() || null,
    caption: post.caption?.trim() || null,
    published_at: post.publishedAt,
    media_type: normalizeMediaType(post.mediaType),
    media_product_type: post.mediaProductType?.trim() || null,
    visual_description: post.visualDescription?.trim() || null,
    audio_transcript: post.audioTranscript?.trim() || null,
  }));

  const { data: savedPosts, error: postsError } = await admin
    .from("instagram_posts")
    .upsert(postRows, { onConflict: "external_media_id" })
    .select("id, external_media_id");

  if (postsError) throw new Error("Não foi possível salvar os posts do Instagram.");
  const postIdByExternalId = new Map(((savedPosts ?? []) as PostRow[]).map((post) => [post.external_media_id, post.id]));

  const categoryAssignments = posts.flatMap((post) => {
    const postId = postIdByExternalId.get(post.externalMediaId);
    if (!postId) return [];

    return suggestContentCategories(post)
      .map((suggestion) => {
        const categoryId = categoryIdBySlug.get(suggestion.slug);
        if (!categoryId) return null;
        return {
          post_id: postId,
          category_id: categoryId,
          source: suggestion.source,
          confidence: suggestion.confidence,
          review_status: "suggested",
        };
      })
      .filter((assignment): assignment is NonNullable<typeof assignment> => assignment !== null);
  });

  if (categoryAssignments.length > 0) {
    const { error: assignmentsError } = await admin
      .from("instagram_post_categories")
      .upsert(categoryAssignments, { onConflict: "post_id,category_id", ignoreDuplicates: true });
    if (assignmentsError) throw new Error("Não foi possível salvar as sugestões de categoria.");
  }

  const eventAssignments = posts.flatMap((post) => {
    const postId = postIdByExternalId.get(post.externalMediaId);
    if (!postId) return [];
    return (post.eventIds ?? []).map((eventId) => ({ post_id: postId, event_id: eventId, source: "manual", confidence: null }));
  });

  if (eventAssignments.length > 0) {
    const { error: eventsError } = await admin
      .from("instagram_post_events")
      .upsert(eventAssignments, { onConflict: "post_id,event_id", ignoreDuplicates: true });
    if (eventsError) throw new Error("Não foi possível associar os posts aos eventos.");
  }

  return { importedPosts: savedPosts?.length ?? 0, suggestedAssignments: categoryAssignments.length };
}

/** Saves the performance history collected separately from the post metadata. */
export async function importInstagramMetricSnapshots(snapshots: InstagramMetricSnapshotImport[]) {
  if (snapshots.length === 0) return { importedSnapshots: 0 };

  const admin = createAdminClient();
  const mediaIds = [...new Set(snapshots.map((snapshot) => snapshot.externalMediaId))];
  const { data: posts, error: postsError } = await admin
    .from("instagram_posts")
    .select("id, external_media_id")
    .in("external_media_id", mediaIds);

  if (postsError) throw new Error("Não foi possível localizar os posts para salvar as métricas.");
  const postIdByExternalId = new Map(((posts ?? []) as PostRow[]).map((post) => [post.external_media_id, post.id]));
  const rows = snapshots.flatMap((snapshot) => {
    const postId = postIdByExternalId.get(snapshot.externalMediaId);
    if (!postId) return [];
    return [{
      post_id: postId,
      collected_at: snapshot.collectedAt,
      reach: asNonNegativeInteger(snapshot.reach),
      views: asNonNegativeInteger(snapshot.views),
      likes: asNonNegativeInteger(snapshot.likes),
      comments: asNonNegativeInteger(snapshot.comments),
      shares: asNonNegativeInteger(snapshot.shares),
      saves: asNonNegativeInteger(snapshot.saves),
      profile_activity: asNonNegativeInteger(snapshot.profileActivity),
      website_clicks: asNonNegativeInteger(snapshot.websiteClicks),
    }];
  });

  if (rows.length === 0) return { importedSnapshots: 0 };
  const { error } = await admin
    .from("instagram_post_metric_snapshots")
    .upsert(rows, { onConflict: "post_id,collected_at" });
  if (error) throw new Error("Não foi possível salvar as métricas do Instagram.");

  return { importedSnapshots: rows.length };
}
