import { NextResponse } from "next/server";

import {
  ACTIVATION_COOKIE_NAME,
  activationHashesMatch,
  activationCodeIsValid,
  activationCookieOptions,
  createActivationSession,
  hashActivationCode,
  normalizeActivationCode,
} from "@/lib/auth/activation";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

type ActivationProfile = {
  id: string;
  must_set_password: boolean;
  activation_code_hash: string | null;
  activation_code_expires_at: string | null;
};

function error(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => null) as { email?: unknown; code?: unknown } | null;
  const email = typeof body?.email === "string" ? body.email.trim().toLowerCase() : "";
  const code = typeof body?.code === "string" ? normalizeActivationCode(body.code) : "";
  if (!emailPattern.test(email)) return error("Informe um e-mail válido.");

  const admin = createAdminClient();
  const { data, error: profileError } = await admin
    .from("datarun_user_profiles")
    .select("id, must_set_password, activation_code_hash, activation_code_expires_at")
    .eq("email", email)
    .maybeSingle();
  if (profileError) return error("Não foi possível validar este acesso agora.", 503);

  const profile = data as ActivationProfile | null;
  const canActivate = Boolean(
    profile?.must_set_password
    && profile.activation_code_hash
    && activationCodeIsValid(profile.activation_code_expires_at),
  );

  if (!code) {
    if (canActivate) return NextResponse.json({ requiresActivationCode: true });
    return error("Informe sua senha para entrar. No primeiro acesso, peça o código de ativação ao administrador.");
  }

  if (!canActivate || !profile || code.length < 12) {
    return error("Código de ativação inválido ou expirado.");
  }

  const providedHash = hashActivationCode(profile.id, code);
  const storedHash = profile.activation_code_hash!;
  if (!activationHashesMatch(providedHash, storedHash)) {
    return error("Código de ativação inválido ou expirado.");
  }

  const expiresAt = profile.activation_code_expires_at!;
  const response = NextResponse.json({ status: "ready" });
  response.cookies.set(
    ACTIVATION_COOKIE_NAME,
    createActivationSession(profile.id, storedHash, expiresAt),
    activationCookieOptions(expiresAt),
  );
  return response;
}
