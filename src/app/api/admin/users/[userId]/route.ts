import { getApiUserAccess, isAdministrator, type DashboardRole } from "@/lib/auth/access";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function jsonError(message: string, status: number) {
  return Response.json({ error: message }, { status });
}

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

function readRole(value: unknown): DashboardRole | null {
  return value === "ADMINISTRATOR" || value === "ORGANIZER" ? value : null;
}

async function getTargetUser(userId: string) {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("datarun_user_profiles")
    .select("id, email, role")
    .eq("id", userId)
    .maybeSingle();

  return { admin, target: data as { id: string; email: string; role: DashboardRole } | null, error };
}

async function canRemoveAdministrator(admin: ReturnType<typeof createAdminClient>, role: DashboardRole) {
  if (role !== "ADMINISTRATOR") return true;

  const { count, error } = await admin
    .from("datarun_user_profiles")
    .select("id", { count: "exact", head: true })
    .eq("role", "ADMINISTRATOR");

  if (error) return null;
  return (count ?? 0) > 1;
}

export async function PATCH(request: Request, { params }: { params: Promise<{ userId: string }> }) {
  const access = await getApiUserAccess();
  if (!access) return jsonError("Faça login para gerenciar acessos.", 401);
  if (!isAdministrator(access)) return jsonError("Somente administradores podem alterar níveis de acesso.", 403);

  const { userId } = await params;
  if (!isUuid(userId)) return jsonError("O usuário informado não é válido.", 400);
  if (userId === access.id) return jsonError("Por segurança, outro administrador deve alterar o nível da sua própria conta.", 400);

  const body = await request.json().catch(() => null) as { role?: unknown } | null;
  const role = readRole(body?.role);
  if (!role) return jsonError("Informe um nível de acesso válido.", 400);

  const { admin, target, error: targetError } = await getTargetUser(userId);
  if (targetError) return jsonError("Não foi possível consultar este acesso.", 500);
  if (!target) return jsonError("Este acesso não foi encontrado.", 404);
  if (target.role === role) return Response.json({ user: target });

  const canChange = await canRemoveAdministrator(admin, target.role);
  if (canChange === null) return jsonError("Não foi possível validar os administradores cadastrados.", 500);
  if (!canChange) return jsonError("Mantenha ao menos um administrador ativo no DataRun.", 400);

  const { data: updated, error: updateError } = await admin
    .from("datarun_user_profiles")
    .update({ role })
    .eq("id", userId)
    .select("id, email, role")
    .maybeSingle();
  if (updateError || !updated) return jsonError("Não foi possível atualizar o nível de acesso.", 500);

  return Response.json({ user: updated });
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ userId: string }> }) {
  const access = await getApiUserAccess();
  if (!access) return jsonError("Faça login para gerenciar acessos.", 401);
  if (!isAdministrator(access)) return jsonError("Somente administradores podem excluir acessos.", 403);

  const { userId } = await params;
  if (!isUuid(userId)) return jsonError("O usuário informado não é válido.", 400);
  if (userId === access.id) return jsonError("Você não pode excluir a própria conta enquanto estiver conectado.", 400);

  const { admin, target, error: targetError } = await getTargetUser(userId);
  if (targetError) return jsonError("Não foi possível consultar este acesso.", 500);
  if (!target) return jsonError("Este acesso não foi encontrado.", 404);

  const canDelete = await canRemoveAdministrator(admin, target.role);
  if (canDelete === null) return jsonError("Não foi possível validar os administradores cadastrados.", 500);
  if (!canDelete) return jsonError("Mantenha ao menos um administrador ativo no DataRun.", 400);

  const { error: deleteError } = await admin.auth.admin.deleteUser(userId);
  if (deleteError) return jsonError("Não foi possível excluir este acesso.", 500);

  return Response.json({ deletedUserId: userId });
}
