import { getApiUserAccess, isAdministrator } from "@/lib/auth/access";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

function jsonError(message: string, status: number) {
  return Response.json({ error: message }, { status });
}

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

function isDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

export async function PATCH(request: Request, { params }: { params: Promise<{ eventId: string }> }) {
  const access = await getApiUserAccess();
  if (!access) return jsonError("Faça login para atualizar um evento.", 401);
  if (!isAdministrator(access)) return jsonError("Somente administradores podem atualizar eventos.", 403);

  const { eventId } = await params;
  if (!isUuid(eventId)) return jsonError("O evento informado não é válido.", 400);

  const body = await request.json().catch(() => null) as { eventDate?: unknown; firstLotEndsOn?: unknown } | null;
  const eventDate = typeof body?.eventDate === "string" ? body.eventDate.trim() : "";
  const firstLotEndsOn = typeof body?.firstLotEndsOn === "string" ? body.firstLotEndsOn.trim() : "";
  if (eventDate && !isDate(eventDate)) {
    return jsonError("Informe uma data válida para o evento.", 400);
  }
  if (firstLotEndsOn && !isDate(firstLotEndsOn)) {
    return jsonError("Informe uma data válida para o encerramento do primeiro lote.", 400);
  }

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("events")
    .update({ event_date: eventDate || null, first_lot_ends_on: firstLotEndsOn || null })
    .eq("id", eventId)
    .select("id, event_date, first_lot_ends_on")
    .maybeSingle();
  if (error) return jsonError("Não foi possível atualizar as datas do evento.", 500);
  if (!data) return jsonError("Este evento não foi encontrado.", 404);

  return Response.json({ eventId: data.id, eventDate: data.event_date, firstLotEndsOn: data.first_lot_ends_on });
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ eventId: string }> }) {
  const access = await getApiUserAccess();
  if (!access) return jsonError("Faça login para excluir um evento.", 401);
  if (!isAdministrator(access)) return jsonError("Somente administradores podem excluir eventos.", 403);

  const { eventId } = await params;
  if (!isUuid(eventId)) return jsonError("O evento informado não é válido.", 400);

  const admin = createAdminClient();
  const [{ data: event, error: eventError }, { count: registrationCount, error: countError }] = await Promise.all([
    admin.from("events").select("id, name").eq("id", eventId).maybeSingle(),
    admin.from("event_registrations").select("id", { count: "exact", head: true }).eq("event_id", eventId),
  ]);
  if (eventError || countError) return jsonError("Não foi possível preparar a exclusão do evento.", 500);
  if (!event) return jsonError("Este evento não foi encontrado.", 404);

  const { error: registrationsError } = await admin.from("event_registrations").delete().eq("event_id", eventId);
  if (registrationsError) return jsonError("Não foi possível excluir as inscrições associadas ao evento.", 500);

  const { error: importUnlinkError } = await admin.from("registration_imports").update({ event_id: null }).eq("event_id", eventId);
  if (importUnlinkError) return jsonError("As inscrições foram removidas, mas não foi possível atualizar o histórico de importação.", 500);

  const { error: deleteEventError } = await admin.from("events").delete().eq("id", eventId);
  if (deleteEventError) return jsonError("Não foi possível excluir o evento.", 500);

  return Response.json({ deletedEventId: eventId, deletedRegistrations: registrationCount ?? 0 });
}
