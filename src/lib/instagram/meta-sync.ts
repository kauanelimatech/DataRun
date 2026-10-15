import "server-only";

import { importInstagramMetricSnapshots, importInstagramPosts, type InstagramPostImport } from "@/lib/instagram/import-posts";

type MediaItem = {
  id: string;
  caption?: string;
  media_type?: string;
  media_product_type?: string;
  permalink?: string;
  timestamp?: string;
  like_count?: number;
  comments_count?: number;
};

type MediaPage = {
  data?: MediaItem[];
  paging?: { next?: string };
};

type InsightResponse = {
  data?: Array<{ name?: string; values?: Array<{ value?: number }> }>;
};

const MAX_MEDIA_PAGES = 10;
const INSIGHT_METRICS = ["reach", "views", "plays", "saved", "shares"] as const;

function graphUrl(path: string) {
  return new URL(`https://graph.instagram.com/${path.replace(/^\//, "")}`);
}

async function graphJson<T>(url: URL | string) {
  const response = await fetch(url, { cache: "no-store" });
  const payload = await response.json().catch(() => null) as T | null;
  if (!response.ok || !payload) throw new Error("A Meta não retornou os dados solicitados do Instagram.");
  return payload;
}

async function fetchPostInsights(mediaId: string, accessToken: string) {
  const result: Record<string, number> = {};

  await Promise.all(INSIGHT_METRICS.map(async (metric) => {
    try {
      const url = graphUrl(`${mediaId}/insights`);
      url.searchParams.set("metric", metric);
      url.searchParams.set("access_token", accessToken);
      const payload = await graphJson<InsightResponse>(url);
      const value = payload.data?.[0]?.values?.at(-1)?.value;
      if (typeof value === "number" && Number.isFinite(value)) result[metric] = value;
    } catch {
      // Metrics vary by media format and account. Unsupported metrics are omitted.
    }
  }));

  return result;
}

export async function syncInstagramMedia(accessToken: string) {
  const firstUrl = graphUrl("me/media");
  firstUrl.searchParams.set("fields", "id,caption,media_type,media_product_type,permalink,timestamp,like_count,comments_count");
  firstUrl.searchParams.set("limit", "100");
  firstUrl.searchParams.set("access_token", accessToken);

  let nextUrl: string | undefined = firstUrl.toString();
  const media: MediaItem[] = [];
  let pages = 0;
  while (nextUrl && pages < MAX_MEDIA_PAGES) {
    const page: MediaPage = await graphJson<MediaPage>(nextUrl);
    media.push(...(page.data ?? []));
    nextUrl = page.paging?.next;
    pages += 1;
  }

  const posts: InstagramPostImport[] = media.flatMap((item) => {
    if (!item.id || !item.timestamp) return [];
    return [{
      externalMediaId: item.id,
      caption: item.caption ?? null,
      permalink: item.permalink ?? null,
      publishedAt: item.timestamp,
      mediaType: item.media_type ?? null,
      mediaProductType: item.media_product_type ?? null,
    }];
  });
  const postResult = await importInstagramPosts(posts);

  const collectedAt = new Date().toISOString();
  const metrics = await Promise.all(media.map(async (item) => {
    const insights = await fetchPostInsights(item.id, accessToken);
    return {
      externalMediaId: item.id,
      collectedAt,
      reach: insights.reach ?? null,
      views: insights.views ?? insights.plays ?? null,
      likes: item.like_count ?? null,
      comments: item.comments_count ?? null,
      shares: insights.shares ?? null,
      saves: insights.saved ?? null,
    };
  }));
  const metricsResult = await importInstagramMetricSnapshots(metrics);

  return { ...postResult, ...metricsResult, pages };
}
