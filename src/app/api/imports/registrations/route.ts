import { createHash, createHmac } from "node:crypto";

import { type ParsedRegistration, parseRegistrationFile, RegistrationFileValidationError } from "@/lib/imports/registration-file";
import { getApiUserAccess, isAdministrator } from "@/lib/auth/access";
import { revalidateDashboardData } from "@/lib/dashboard-data";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_FILE_SIZE = 15 * 1024 * 1024;
const ACCEPTED_EXTENSIONS = new Set(["csv", "numbers", "xls", "xlsx", "xlsl"]);
const BATCH_SIZE = 250;

type DatabaseRegistration = {
  event_id: string;
  latest_import_id: string;
  source_row_number: number;
  source_year: number;
  source_stage: string;
  registration_hash: string;
  purchase_hash: string | null;
  lot_name: string | null;
  kit_name: string | null;
  list_price: number | null;
  registered_on: string;
  is_credentialed: boolean;
  credentialed_at: string | null;
  discount_coupon: string | null;
  discount_amount: number;
  final_amount: number;
  registration_status: string;
  purchase_status: string;
  marketing_opt_in: boolean;
  source_updated_on: string | null;
  city: string | null;
  age_range: string | null;
  discount_type: string | null;
  route_name: string | null;
  shirt_size: string | null;
  kit_pickup_location: string | null;
  terms_accepted: boolean;
  participation_profile: string | null;
  participation_reason: string | null;
  favorite_event_feature: string | null;
  affiliate_code: string | null;
  utm_source: string | null;
  utm_medium: string | null;
  utm_campaign: string | null;
};

function jsonError(message: string, status: number, extra: Record<string, unknown> = {}) {
  return Response.json({ error: message, ...extra }, { status });
}

function extensionOf(fileName: string) {
  const segments = fileName.toLowerCase().split(".");
  return segments.length > 1 ? segments.at(-1) ?? "" : "";
}

function hashSourceIdentifier(secret: string, purpose: string, eventId: string, sourceId: string | null) {
  if (!sourceId) return null;
  return createHmac("sha256", secret).update(`${purpose}:${eventId}:${sourceId}`).digest("hex");
}

function toDatabaseRegistration(record: ParsedRegistration, eventId: string, importId: string, hashSecret: string): DatabaseRegistration {
  return {
    event_id: eventId,
    latest_import_id: importId,
    source_row_number: record.sourceRowNumber,
    source_year: record.sourceYear,
    source_stage: record.sourceStage,
    registration_hash: hashSourceIdentifier(hashSecret, "registration", eventId, record.externalRegistrationId)!,
    purchase_hash: hashSourceIdentifier(hashSecret, "purchase", eventId, record.externalPurchaseId),
    lot_name: record.lotName,
    kit_name: record.kitName,
    list_price: record.listPrice,
    registered_on: record.registeredOn,
    is_credentialed: record.isCredentialed,
    credentialed_at: record.credentialedAt,
    discount_coupon: record.discountCoupon,
    discount_amount: record.discountAmount,
    final_amount: record.finalAmount,
    registration_status: record.registrationStatus,
    purchase_status: record.purchaseStatus,
    marketing_opt_in: record.marketingOptIn,
    source_updated_on: record.sourceUpdatedOn,
    city: record.city,
    age_range: record.ageRange,
    discount_type: record.discountType,
    route_name: record.routeName,
    shirt_size: record.shirtSize,
    kit_pickup_location: record.kitPickupLocation,
    terms_accepted: record.termsAccepted,
    participation_profile: record.participationProfile,
    participation_reason: record.participationReason,
    favorite_event_feature: record.favoriteEventFeature,
    affiliate_code: record.affiliateCode,
    utm_source: record.utmSource,
    utm_medium: record.utmMedium,
    utm_campaign: record.utmCampaign,
  };
}

export async function POST(request: Request) {
  const access = await getApiUserAccess();
  if (!access) return jsonError("Faça login para importar arquivos.", 401);
  if (!isAdministrator(access)) return jsonError("Somente administradores podem importar arquivos.", 403);

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return jsonError("Envie o arquivo no formato multipart/form-data.", 400);
  }

  const file = formData.get("file");
  if (!(file instanceof File)) return jsonError("Selecione um arquivo para importar.", 400);
  if (file.size === 0) return jsonError("O arquivo selecionado está vazio.", 400);
  if (file.size > MAX_FILE_SIZE) return jsonError("O arquivo excede o limite de 15 MB.", 413);

  const extension = extensionOf(file.name);
  if (!ACCEPTED_EXTENSIONS.has(extension)) {
    return jsonError("Formato não suportado. Envie um arquivo .numbers, .csv, .xls ou .xlsx.", 415);
  }

  let parsed;
  let fileBuffer: Buffer;
  try {
    fileBuffer = Buffer.from(await file.arrayBuffer());
    parsed = parseRegistrationFile(fileBuffer);
  } catch (error) {
    if (error instanceof RegistrationFileValidationError) {
      return jsonError(error.message, 422, { issues: error.issues });
    }
    return jsonError("Não foi possível processar este arquivo.", 422);
  }

  let admin;
  try {
    admin = createAdminClient();
  } catch {
    return jsonError("A importação ainda não está configurada no servidor. Adicione a SUPABASE_SECRET_KEY ao ambiente local ou à Vercel.", 503);
  }

  const { data: importSettings, error: importSettingsError } = await admin
    .from("datarun_import_settings")
    .select("registration_hash_secret")
    .eq("singleton", true)
    .single();
  const hashSecret = importSettings?.registration_hash_secret as string | undefined;
  if (importSettingsError || !hashSecret) {
    return jsonError("A proteção de identificadores ainda não foi configurada no banco. Execute as migrations pendentes do projeto.", 503);
  }

  const checksum = createHash("sha256").update(fileBuffer).digest("hex");
  const { data: importRow, error: createImportError } = await admin
    .from("registration_imports")
    .insert({
      event_id: null,
      source_file_name: file.name,
      source_file_checksum: checksum,
      imported_by: access.id,
      status: "processing",
      source_record_count: parsed.sourceRecordCount,
      error_details: [],
      started_at: new Date().toISOString(),
    })
    .select("id")
    .single();

  if (createImportError || !importRow) return jsonError("Não foi possível iniciar a importação.", 500);
  const importId = importRow.id as string;

  try {
    const eventDefinitions = Array.from(new Map(parsed.records.map((record) => {
      const key = `${record.sourceYear}::${record.sourceStage}`;
      return [key, { edition_year: record.sourceYear, source_stage: record.sourceStage, name: record.sourceStage }];
    })).values());

    const { data: events, error: eventError } = await admin
      .from("events")
      .upsert(eventDefinitions, { onConflict: "edition_year,source_stage" })
      .select("id, edition_year, source_stage");
    if (eventError || !events) throw new Error("Não foi possível preparar os eventos da planilha.");

    const eventIds = new Map(events.map((event) => [`${event.edition_year}::${event.source_stage}`, event.id as string]));
    const recordsByEvent = new Map<string, ParsedRegistration[]>();
    parsed.records.forEach((record) => {
      const eventId = eventIds.get(`${record.sourceYear}::${record.sourceStage}`);
      if (!eventId) throw new Error("Não foi possível relacionar uma etapa ao evento correspondente.");
      const current = recordsByEvent.get(eventId) ?? [];
      current.push(record);
      recordsByEvent.set(eventId, current);
    });

    let inserted = 0;
    let updated = 0;
    for (const [eventId, records] of recordsByEvent) {
      for (let start = 0; start < records.length; start += BATCH_SIZE) {
        const batch = records.slice(start, start + BATCH_SIZE);
        const registrationHashes = batch.map((record) => hashSourceIdentifier(hashSecret, "registration", eventId, record.externalRegistrationId)!);
        const { data: existingRows, error: existingError } = await admin
          .from("event_registrations")
          .select("registration_hash")
          .eq("event_id", eventId)
          .in("registration_hash", registrationHashes);
        if (existingError) throw new Error("Não foi possível verificar as inscrições existentes.");

        const existingHashes = new Set((existingRows ?? []).map((row) => String(row.registration_hash)));
        updated += registrationHashes.filter((hash) => existingHashes.has(hash)).length;
        inserted += registrationHashes.filter((hash) => !existingHashes.has(hash)).length;

        const { error: upsertError } = await admin
          .from("event_registrations")
          .upsert(batch.map((record) => toDatabaseRegistration(record, eventId, importId, hashSecret)), { onConflict: "event_id,registration_hash" });
        if (upsertError) throw new Error("Não foi possível gravar uma parte das inscrições.");
      }
    }

    const { error: finishError } = await admin
      .from("registration_imports")
      .update({
        status: "completed",
        inserted_record_count: inserted,
        updated_record_count: updated,
        error_details: parsed.warnings,
        completed_at: new Date().toISOString(),
      })
      .eq("id", importId);
    if (finishError) throw new Error("As inscrições foram gravadas, mas o histórico da importação não pôde ser concluído.");

    revalidateDashboardData();

    return Response.json({
      importId,
      fileName: file.name,
      processed: parsed.sourceRecordCount,
      inserted,
      updated,
      eventCount: eventIds.size,
      warnings: parsed.warnings,
    });
  } catch {
    await admin
      .from("registration_imports")
      .update({
        status: "failed",
        error_details: [{ message: "O processamento foi interrompido antes da conclusão." }],
        completed_at: new Date().toISOString(),
      })
      .eq("id", importId);

    return jsonError("Não foi possível concluir a importação. Nenhum novo arquivo foi marcado como concluído.", 500);
  }
}
