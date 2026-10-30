import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";

const PAGE_SIZE = 1_000;

type EventRow = {
  id: string;
  name: string;
  edition_year: number;
  source_stage: string | null;
  event_date: string | null;
  first_lot_ends_on: string | null;
};

type RegistrationRow = {
  event_id: string;
  registered_on: string;
  final_amount: number | string;
  registration_status: string;
  purchase_status: string;
  lot_name: string | null;
  kit_name: string | null;
  route_name: string | null;
  city: string | null;
  age_range: string | null;
};

type ImportRow = {
  id: string;
  source_file_name: string;
  status: string;
  source_record_count: number;
  inserted_record_count: number;
  updated_record_count: number;
  completed_at: string | null;
  created_at: string;
};

type InstagramPostRow = {
  id: string;
  caption: string | null;
  permalink: string | null;
  published_at: string;
  media_type: string;
};

type InstagramMetricSnapshotRow = {
  post_id: string;
  collected_at: string;
  reach: number | string | null;
  views: number | string | null;
  likes: number | string | null;
  comments: number | string | null;
  shares: number | string | null;
  saves: number | string | null;
};

type InstagramCategoryAssignmentRow = {
  post_id: string;
  category_id: string;
  review_status: string;
  updated_at: string;
};

type ContentCategoryRow = {
  id: string;
  name: string;
};

type SocialPost = {
  id: string;
  caption: string | null;
  permalink: string | null;
  publishedDate: string;
  mediaType: string;
  categoryName: string;
  reach: number;
  engagement: number;
};

export type DailyRegistration = {
  date: string;
  registrations: number;
  revenue: number;
};

export type ValueBreakdown = {
  label: string;
  value: number;
};

export type CorrelationDailyPoint = {
  date: string;
  registrations: number;
  revenue: number;
  posts: number;
  reach: number;
  engagement: number;
};

export type ContentCategoryImpact = {
  name: string;
  postCount: number;
  reach: number;
  engagement: number;
  averageRegistrations24h: number;
  averageRegistrationLift24h: number | null;
};

export type PostCorrelationImpact = {
  id: string;
  caption: string | null;
  permalink: string | null;
  publishedDate: string;
  mediaType: string;
  categoryName: string;
  reach: number;
  engagement: number;
  registrations24h: number;
  registrationLift24h: number | null;
};

export type DashboardCorrelation = {
  hasComparablePeriod: boolean;
  startDate: string | null;
  endDate: string | null;
  postCount: number;
  reach: number;
  engagement: number;
  correlationWithPosts: number | null;
  correlationWithEngagement: number | null;
  daily: CorrelationDailyPoint[];
  categoryImpacts: ContentCategoryImpact[];
  topPostImpacts: PostCorrelationImpact[];
};

export type DashboardEvent = {
  id: string;
  name: string;
  year: number;
  stage: string | null;
  eventDate: string | null;
  firstLotEndsOn: string | null;
  totalRegistrations: number;
  confirmedRegistrations: number;
  paidRegistrations: number;
  revenue: number;
  averageTicket: number;
  dailyRegistrations: DailyRegistration[];
  ageRanges: ValueBreakdown[];
  lots: ValueBreakdown[];
  routes: ValueBreakdown[];
};

export type DashboardImport = {
  id: string;
  fileName: string;
  status: string;
  sourceRecordCount: number;
  insertedRecordCount: number;
  updatedRecordCount: number;
  completedAt: string | null;
  createdAt: string;
};

export type DashboardData = {
  events: DashboardEvent[];
  allEvents: DashboardEvent;
  imports: DashboardImport[];
  correlations: Record<string, DashboardCorrelation>;
};

function normalizeStatus(value: string) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
}

function isConfirmed(record: RegistrationRow) {
  return normalizeStatus(record.registration_status) === "confirmada";
}

function isPaid(record: RegistrationRow) {
  return normalizeStatus(record.purchase_status) === "paga";
}

function asNumber(value: number | string) {
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function breakdown(records: RegistrationRow[], key: keyof Pick<RegistrationRow, "age_range" | "lot_name" | "route_name">, fallback = "Não informado") {
  const totals = new Map<string, number>();
  records.forEach((record) => {
    const label = record[key] || fallback;
    totals.set(label, (totals.get(label) ?? 0) + 1);
  });
  return Array.from(totals, ([label, value]) => ({ label, value })).sort((left, right) => right.value - left.value || left.label.localeCompare(right.label));
}

function daily(records: RegistrationRow[]) {
  const totals = new Map<string, DailyRegistration>();
  records.forEach((record) => {
    const current = totals.get(record.registered_on) ?? { date: record.registered_on, registrations: 0, revenue: 0 };
    current.registrations += 1;
    if (isConfirmed(record) && isPaid(record)) current.revenue += asNumber(record.final_amount);
    totals.set(record.registered_on, current);
  });
  return Array.from(totals.values()).sort((left, right) => left.date.localeCompare(right.date));
}

async function fetchAllRegistrations() {
  const admin = createAdminClient();
  const records: RegistrationRow[] = [];
  let from = 0;

  while (true) {
    const { data, error } = await admin
      .from("event_registrations")
      .select("event_id, registered_on, final_amount, registration_status, purchase_status, lot_name, kit_name, route_name, city, age_range")
      .range(from, from + PAGE_SIZE - 1);
    if (error) throw new Error("Não foi possível carregar as inscrições do painel.");
    const page = (data ?? []) as RegistrationRow[];
    records.push(...page);
    if (page.length < PAGE_SIZE) return records;
    from += PAGE_SIZE;
  }
}

type PageResult<T> = {
  data: T[] | null;
  error: unknown;
};

async function fetchAllPages<T>(fetchPage: (from: number, to: number) => Promise<PageResult<T>>) {
  const rows: T[] = [];

  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await fetchPage(from, from + PAGE_SIZE - 1);
    if (error) throw new Error("Não foi possível carregar os dados sociais para o painel.");

    const page = data ?? [];
    rows.push(...page);
    if (page.length < PAGE_SIZE) return rows;
  }
}

async function fetchSocialPosts(): Promise<SocialPost[]> {
  const admin = createAdminClient();
  const [posts, snapshots, assignments, categories] = await Promise.all([
    fetchAllPages<InstagramPostRow>(async (from, to) => admin
      .from("instagram_posts")
      .select("id, caption, permalink, published_at, media_type")
      .order("id", { ascending: true })
      .range(from, to)),
    fetchAllPages<InstagramMetricSnapshotRow>(async (from, to) => admin
      .from("instagram_post_metric_snapshots")
      .select("post_id, collected_at, reach, views, likes, comments, shares, saves")
      .order("post_id", { ascending: true })
      .order("collected_at", { ascending: true })
      .range(from, to)),
    fetchAllPages<InstagramCategoryAssignmentRow>(async (from, to) => admin
      .from("instagram_post_categories")
      .select("post_id, category_id, review_status, updated_at")
      .order("post_id", { ascending: true })
      .order("category_id", { ascending: true })
      .range(from, to)),
    admin.from("content_categories").select("id, name"),
  ]);

  if (categories.error) throw new Error("Não foi possível carregar as categorias sociais para o painel.");

  const categoryNameById = new Map(((categories.data ?? []) as ContentCategoryRow[]).map((category) => [category.id, category.name]));
  const latestMetricByPost = new Map<string, InstagramMetricSnapshotRow>();
  snapshots.forEach((snapshot) => {
    const current = latestMetricByPost.get(snapshot.post_id);
    if (!current || current.collected_at < snapshot.collected_at) latestMetricByPost.set(snapshot.post_id, snapshot);
  });

  const confirmedCategoryByPost = new Map<string, InstagramCategoryAssignmentRow>();
  assignments
    .filter((assignment) => assignment.review_status === "confirmed")
    .forEach((assignment) => {
      const current = confirmedCategoryByPost.get(assignment.post_id);
      if (!current || current.updated_at < assignment.updated_at) confirmedCategoryByPost.set(assignment.post_id, assignment);
    });

  return posts.flatMap((post) => {
    const date = post.published_at.slice(0, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return [];

    const metric = latestMetricByPost.get(post.id);
    const category = confirmedCategoryByPost.get(post.id);
    return [{
      id: post.id,
      caption: post.caption,
      permalink: post.permalink,
      publishedDate: date,
      mediaType: post.media_type,
      categoryName: categoryNameById.get(category?.category_id ?? "") ?? "Sem categoria",
      reach: asNumber(metric?.reach ?? 0),
      engagement: asNumber(metric?.likes ?? 0) + asNumber(metric?.comments ?? 0) + asNumber(metric?.shares ?? 0) + asNumber(metric?.saves ?? 0),
    } satisfies SocialPost];
  });
}

function addDays(date: string, days: number) {
  const value = new Date(`${date}T00:00:00Z`);
  value.setUTCDate(value.getUTCDate() + days);
  return value.toISOString().slice(0, 10);
}

function pearson(left: number[], right: number[]) {
  if (left.length !== right.length || left.length < 3) return null;
  const leftMean = left.reduce((total, value) => total + value, 0) / left.length;
  const rightMean = right.reduce((total, value) => total + value, 0) / right.length;
  let covariance = 0;
  let leftVariance = 0;
  let rightVariance = 0;
  left.forEach((value, index) => {
    const leftDifference = value - leftMean;
    const rightDifference = right[index] - rightMean;
    covariance += leftDifference * rightDifference;
    leftVariance += leftDifference * leftDifference;
    rightVariance += rightDifference * rightDifference;
  });
  const denominator = Math.sqrt(leftVariance * rightVariance);
  return denominator === 0 ? null : covariance / denominator;
}

function emptyCorrelation(): DashboardCorrelation {
  return {
    hasComparablePeriod: false,
    startDate: null,
    endDate: null,
    postCount: 0,
    reach: 0,
    engagement: 0,
    correlationWithPosts: null,
    correlationWithEngagement: null,
    daily: [],
    categoryImpacts: [],
    topPostImpacts: [],
  };
}

function buildCorrelation(records: RegistrationRow[], socialPosts: SocialPost[], range: "registrations" | "overlap" = "registrations"): DashboardCorrelation {
  const registrations = daily(records);
  if (registrations.length === 0) return emptyCorrelation();

  let startDate = registrations[0].date;
  let endDate = registrations.at(-1)!.date;
  if (range === "overlap") {
    if (socialPosts.length === 0) return emptyCorrelation();
    const postDates = socialPosts.map((post) => post.publishedDate).sort();
    startDate = startDate > postDates[0] ? startDate : postDates[0];
    endDate = endDate < postDates.at(-1)! ? endDate : postDates.at(-1)!;
    if (startDate > endDate) return emptyCorrelation();
  }

  const registrationsByDate = new Map(registrations.map((item) => [item.date, item]));
  const posts = socialPosts.filter((post) => post.publishedDate >= startDate && post.publishedDate <= endDate);
  const postsByDate = new Map<string, SocialPost[]>();
  posts.forEach((post) => {
    const current = postsByDate.get(post.publishedDate) ?? [];
    current.push(post);
    postsByDate.set(post.publishedDate, current);
  });

  const points: CorrelationDailyPoint[] = [];
  for (let date = startDate; date <= endDate; date = addDays(date, 1)) {
    const registration = registrationsByDate.get(date);
    const dailyPosts = postsByDate.get(date) ?? [];
    points.push({
      date,
      registrations: registration?.registrations ?? 0,
      revenue: registration?.revenue ?? 0,
      posts: dailyPosts.length,
      reach: dailyPosts.reduce((total, post) => total + post.reach, 0),
      engagement: dailyPosts.reduce((total, post) => total + post.engagement, 0),
    });
  }

  const impacts = posts.map((post) => {
    const registrations24h = (registrationsByDate.get(post.publishedDate)?.registrations ?? 0)
      + (registrationsByDate.get(addDays(post.publishedDate, 1))?.registrations ?? 0);
    const precedingWeek = Array.from({ length: 7 }, (_, index) => registrationsByDate.get(addDays(post.publishedDate, -index - 1))?.registrations ?? 0);
    const baseline = precedingWeek.reduce((total, value) => total + value, 0) / precedingWeek.length;
    const hasBaseline = precedingWeek.some((value) => value > 0);
    return {
      ...post,
      registrations24h,
      registrationLift24h: hasBaseline ? registrations24h - baseline * 2 : null,
    } satisfies PostCorrelationImpact;
  });

  const categoryTotals = new Map<string, { postCount: number; reach: number; engagement: number; registrations24h: number; lifts: number[] }>();
  impacts.forEach((post) => {
    const current = categoryTotals.get(post.categoryName) ?? { postCount: 0, reach: 0, engagement: 0, registrations24h: 0, lifts: [] };
    current.postCount += 1;
    current.reach += post.reach;
    current.engagement += post.engagement;
    current.registrations24h += post.registrations24h;
    if (post.registrationLift24h !== null) current.lifts.push(post.registrationLift24h);
    categoryTotals.set(post.categoryName, current);
  });

  return {
    hasComparablePeriod: posts.length > 0,
    startDate,
    endDate,
    postCount: posts.length,
    reach: posts.reduce((total, post) => total + post.reach, 0),
    engagement: posts.reduce((total, post) => total + post.engagement, 0),
    correlationWithPosts: pearson(points.map((point) => point.registrations), points.map((point) => point.posts)),
    correlationWithEngagement: pearson(points.map((point) => point.registrations), points.map((point) => point.engagement)),
    daily: points,
    categoryImpacts: Array.from(categoryTotals, ([name, totals]) => ({
      name,
      postCount: totals.postCount,
      reach: totals.reach,
      engagement: totals.engagement,
      averageRegistrations24h: totals.postCount === 0 ? 0 : totals.registrations24h / totals.postCount,
      averageRegistrationLift24h: totals.lifts.length === 0 ? null : totals.lifts.reduce((total, value) => total + value, 0) / totals.lifts.length,
    })).sort((left, right) => right.averageRegistrations24h - left.averageRegistrations24h || right.engagement - left.engagement),
    topPostImpacts: impacts.sort((left, right) => (right.registrationLift24h ?? -Infinity) - (left.registrationLift24h ?? -Infinity) || right.registrations24h - left.registrations24h).slice(0, 6),
  };
}

export async function getDashboardData(): Promise<DashboardData> {
  const admin = createAdminClient();
  const [{ data: eventRows, error: eventError }, registrationRows, { data: importRows, error: importError }, socialPosts] = await Promise.all([
    admin.from("events").select("id, name, edition_year, source_stage, event_date, first_lot_ends_on").order("edition_year", { ascending: false }).order("name"),
    fetchAllRegistrations(),
    admin.from("registration_imports").select("id, source_file_name, status, source_record_count, inserted_record_count, updated_record_count, completed_at, created_at").order("created_at", { ascending: false }).limit(8),
    fetchSocialPosts(),
  ]);

  if (eventError) throw new Error("Não foi possível carregar os eventos do painel.");
  if (importError) throw new Error("Não foi possível carregar o histórico de importações.");

  const recordsByEvent = new Map<string, RegistrationRow[]>();
  registrationRows.forEach((record) => {
    const current = recordsByEvent.get(record.event_id) ?? [];
    current.push(record);
    recordsByEvent.set(record.event_id, current);
  });

  const events = ((eventRows ?? []) as EventRow[]).map((event) => {
    const records = recordsByEvent.get(event.id) ?? [];
    const paidAndConfirmed = records.filter((record) => isConfirmed(record) && isPaid(record));
    const revenue = paidAndConfirmed.reduce((total, record) => total + asNumber(record.final_amount), 0);
    return {
      id: event.id,
      name: event.name,
      year: event.edition_year,
      stage: event.source_stage,
      eventDate: event.event_date,
      firstLotEndsOn: event.first_lot_ends_on,
      totalRegistrations: records.length,
      confirmedRegistrations: records.filter(isConfirmed).length,
      paidRegistrations: paidAndConfirmed.length,
      revenue,
      averageTicket: paidAndConfirmed.length === 0 ? 0 : revenue / paidAndConfirmed.length,
      dailyRegistrations: daily(records),
      ageRanges: breakdown(records, "age_range"),
      lots: breakdown(records, "lot_name"),
      routes: breakdown(records, "route_name"),
    } satisfies DashboardEvent;
  });

  const imports = ((importRows ?? []) as ImportRow[]).map((importRow) => ({
    id: importRow.id,
    fileName: importRow.source_file_name,
    status: importRow.status,
    sourceRecordCount: importRow.source_record_count,
    insertedRecordCount: importRow.inserted_record_count,
    updatedRecordCount: importRow.updated_record_count,
    completedAt: importRow.completed_at,
    createdAt: importRow.created_at,
  }));

  const correlations: Record<string, DashboardCorrelation> = {
    all: buildCorrelation(registrationRows, socialPosts, "overlap"),
  };
  events.forEach((event) => {
    correlations[event.id] = buildCorrelation(recordsByEvent.get(event.id) ?? [], socialPosts);
  });

  return { events, allEvents: combineEvents(events), imports, correlations };
}

export function combineEvents(events: DashboardEvent[]): DashboardEvent {
  const breakdowns = (field: "ageRanges" | "lots" | "routes") => {
    const values = new Map<string, number>();
    events.flatMap((event) => event[field]).forEach((item) => values.set(item.label, (values.get(item.label) ?? 0) + item.value));
    return Array.from(values, ([label, value]) => ({ label, value })).sort((left, right) => right.value - left.value || left.label.localeCompare(right.label));
  };
  const dailyValues = new Map<string, DailyRegistration>();
  events.flatMap((event) => event.dailyRegistrations).forEach((item) => {
    const current = dailyValues.get(item.date) ?? { date: item.date, registrations: 0, revenue: 0 };
    current.registrations += item.registrations;
    current.revenue += item.revenue;
    dailyValues.set(item.date, current);
  });
  const totalRegistrations = events.reduce((total, event) => total + event.totalRegistrations, 0);
  const confirmedRegistrations = events.reduce((total, event) => total + event.confirmedRegistrations, 0);
  const paidRegistrations = events.reduce((total, event) => total + event.paidRegistrations, 0);
  const revenue = events.reduce((total, event) => total + event.revenue, 0);

  return {
    id: "all",
    name: "Todos os eventos",
    year: 0,
    stage: null,
    eventDate: null,
    firstLotEndsOn: null,
    totalRegistrations,
    confirmedRegistrations,
    paidRegistrations,
    revenue,
    averageTicket: paidRegistrations === 0 ? 0 : revenue / paidRegistrations,
    dailyRegistrations: Array.from(dailyValues.values()).sort((left, right) => left.date.localeCompare(right.date)),
    ageRanges: breakdowns("ageRanges"),
    lots: breakdowns("lots"),
    routes: breakdowns("routes"),
  };
}
