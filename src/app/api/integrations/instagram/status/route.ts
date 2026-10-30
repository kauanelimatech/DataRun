import { getApiUserAccess } from "@/lib/auth/access";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

type ConnectionStatus = "connected" | "error" | "waiting";

export async function GET() {
  const access = await getApiUserAccess();
  if (!access) {
    return Response.json({ error: "Faça login para consultar a integração do Instagram." }, { status: 401 });
  }

  const admin = createAdminClient();
  const { data: connection, error } = await admin
    .from("instagram_connections")
    .select("status")
    .order("connected_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) return Response.json({ error: "Não foi possível consultar a integração do Instagram." }, { status: 500 });

  const status: ConnectionStatus = connection?.status === "connected" || connection?.status === "error"
    ? connection.status
    : "waiting";

  return Response.json({ status }, { headers: { "Cache-Control": "private, max-age=60, stale-while-revalidate=300" } });
}
