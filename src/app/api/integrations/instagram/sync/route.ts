import { getApiUserAccess, isAdministrator } from "@/lib/auth/access";
import { decryptInstagramToken } from "@/lib/instagram/oauth";
import { syncInstagramMedia } from "@/lib/instagram/meta-sync";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function jsonError(message: string, status: number) {
  return Response.json({ error: message }, { status });
}

export async function POST() {
  const access = await getApiUserAccess();
  if (!access) return jsonError("Faça login para sincronizar o Instagram.", 401);
  if (!isAdministrator(access)) return jsonError("Somente administradores podem sincronizar o Instagram.", 403);

  const admin = createAdminClient();
  const { data: connection, error: connectionError } = await admin
    .from("instagram_connections")
    .select("id, access_token_encrypted")
    .eq("status", "connected")
    .order("connected_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (connectionError || !connection) return jsonError("Conecte uma conta do Instagram antes de sincronizar.", 404);

  const { data: run, error: createRunError } = await admin
    .from("instagram_sync_runs")
    .insert({ connection_id: connection.id, triggered_by: access.id, status: "processing" })
    .select("id")
    .single();
  if (createRunError || !run) return jsonError("Não foi possível iniciar a sincronização.", 500);

  try {
    const result = await syncInstagramMedia(decryptInstagramToken(connection.access_token_encrypted));
    const completedAt = new Date().toISOString();
    await Promise.all([
      admin.from("instagram_sync_runs").update({
        status: "completed",
        imported_post_count: result.importedPosts,
        imported_metric_snapshot_count: result.importedSnapshots,
        completed_at: completedAt,
      }).eq("id", run.id),
      admin.from("instagram_connections").update({
        last_synced_at: completedAt,
        last_sync_error: null,
      }).eq("id", connection.id),
    ]);
    return Response.json(result);
  } catch {
    await Promise.all([
      admin.from("instagram_sync_runs").update({
        status: "failed",
        error_details: [{ message: "A Meta recusou ou não retornou os dados da sincronização." }],
        completed_at: new Date().toISOString(),
      }).eq("id", run.id),
      admin.from("instagram_connections").update({
        status: "error",
        last_sync_error: "A Meta recusou ou não retornou os dados da sincronização.",
      }).eq("id", connection.id),
    ]);
    return jsonError("Não foi possível sincronizar agora. Confira as permissões da conta no painel da Meta.", 502);
  }
}
