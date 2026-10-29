import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

function jsonError(message: string, status: number) {
  return Response.json({ error: message }, { status });
}

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ eventId: string }> }) {
  const supabase = await createClient();
  const { data: claims, error: authError } = await supabase.auth.getClaims();
  if (authError || typeof claims?.claims?.sub !== "string") {
    return jsonError("Faça login para excluir um evento.", 401);
  }

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
