import { randomBytes } from "node:crypto";

import { activationCodeExpiration, createActivationCode, hashActivationCode } from "@/lib/auth/activation";
import { getApiUserAccess, isAdministrator } from "@/lib/auth/access";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function jsonError(message: string, status: number) {
  return Response.json({ error: message }, { status });
}

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

export async function POST(_request: Request, { params }: { params: Promise<{ userId: string }> }) {
  const access = await getApiUserAccess();
  if (!access) return jsonError("Faça login para gerenciar acessos.", 401);
  if (!isAdministrator(access)) return jsonError("Somente administradores podem redefinir senhas.", 403);

  const { userId } = await params;
  if (!isUuid(userId)) return jsonError("O usuário informado não é válido.", 400);

  const admin = createAdminClient();
  const { data: target, error: targetError } = await admin
    .from("datarun_user_profiles")
    .select("id, email")
    .eq("id", userId)
    .maybeSingle();
  if (targetError) return jsonError("Não foi possível consultar este acesso.", 500);
  if (!target) return jsonError("Este acesso não foi encontrado.", 404);

  const temporaryPassword = randomBytes(48).toString("base64url");
  const { error: passwordError } = await admin.auth.admin.updateUserById(userId, { password: temporaryPassword });
  if (passwordError) return jsonError("Não foi possível iniciar a redefinição da senha.", 500);

  const now = new Date().toISOString();
  const activationCode = createActivationCode();
  const expiresAt = activationCodeExpiration();
  const { error: profileError } = await admin
    .from("datarun_user_profiles")
    .update({
      must_set_password: true,
      password_reset_at: now,
      access_link_created_at: null,
      activation_code_hash: hashActivationCode(userId, activationCode),
      activation_code_created_at: now,
      activation_code_expires_at: expiresAt,
      activation_code_used_at: null,
    })
    .eq("id", userId);
  if (profileError) return jsonError("A senha foi bloqueada, mas não foi possível preparar o novo acesso.", 500);

  return Response.json({
    email: target.email,
    activationCode,
    activationCodeExpiresAt: expiresAt,
  }, { headers: { "Cache-Control": "no-store" } });
}
