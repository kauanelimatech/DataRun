import { randomBytes } from "node:crypto";

import { createActivationCode, activationCodeExpiration, hashActivationCode } from "@/lib/auth/activation";
import { getApiUserAccess, isAdministrator, type DashboardRole } from "@/lib/auth/access";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function jsonError(message: string, status: number) {
  return Response.json({ error: message }, { status });
}

function readRole(value: unknown): DashboardRole | null {
  return value === "ADMINISTRATOR" || value === "ORGANIZER" ? value : null;
}

export async function POST(request: Request) {
  const access = await getApiUserAccess();
  if (!access) return jsonError("Faça login para gerenciar acessos.", 401);
  if (!isAdministrator(access)) return jsonError("Somente administradores podem criar acessos.", 403);

  const body = await request.json().catch(() => null) as { email?: unknown; role?: unknown } | null;
  const email = typeof body?.email === "string" ? body.email.trim().toLowerCase() : "";
  const role = readRole(body?.role) ?? "ORGANIZER";
  if (!emailPattern.test(email)) return jsonError("Informe um e-mail válido.", 400);

  const admin = createAdminClient();
  const { data: created, error: createError } = await admin.auth.admin.createUser({
    email,
    password: randomBytes(48).toString("base64url"),
    email_confirm: true,
  });
  if (createError || !created?.user) {
    return jsonError(createError?.message || "Não foi possível criar o acesso para este e-mail.", 400);
  }

  const activationCode = createActivationCode();
  const now = new Date().toISOString();
  const expiresAt = activationCodeExpiration();
  const { error: profileError } = await admin
    .from("datarun_user_profiles")
    .upsert({
      id: created.user.id,
      email,
      role,
      must_set_password: true,
      invited_at: now,
      access_link_created_at: null,
      activation_code_hash: hashActivationCode(created.user.id, activationCode),
      activation_code_created_at: now,
      activation_code_expires_at: expiresAt,
      activation_code_used_at: null,
      password_set_at: null,
    }, { onConflict: "id" });
  if (profileError) return jsonError("O usuário foi criado, mas não foi possível configurar as permissões do painel.", 500);

  return Response.json({
    user: { id: created.user.id, email, role },
    activationCode,
    activationCodeExpiresAt: expiresAt,
  }, { headers: { "Cache-Control": "no-store" } });
}
