import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";

const PAGE_SIZE = 1_000;

type EventRow = {
  id: string;
  name: string;
  edition_year: number;
  source_stage: string | null;
  event_date: string | null;
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

export type DailyRegistration = {
  date: string;
  registrations: number;
  revenue: number;
};

export type ValueBreakdown = {
  label: string;
  value: number;
};

export type DashboardEvent = {
  id: string;
  name: string;
  year: number;
  stage: string | null;
  eventDate: string | null;
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

export async function getDashboardData(): Promise<DashboardData> {
  const admin = createAdminClient();
  const [{ data: eventRows, error: eventError }, registrationRows, { data: importRows, error: importError }] = await Promise.all([
    admin.from("events").select("id, name, edition_year, source_stage, event_date").order("edition_year", { ascending: false }).order("name"),
    fetchAllRegistrations(),
    admin.from("registration_imports").select("id, source_file_name, status, source_record_count, inserted_record_count, updated_record_count, completed_at, created_at").order("created_at", { ascending: false }).limit(8),
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

  return { events, allEvents: combineEvents(events), imports };
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
