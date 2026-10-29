import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import {
  ACTIVATION_COOKIE_NAME,
  activationHashesMatch,
  activationCodeIsValid,
  readActivationSession,
} from "@/lib/auth/activation";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type ActivationProfile = {
  email: string;
  activation_code_hash: string | null;
  activation_code_expires_at: string | null;
  must_set_password: boolean;
};

function error(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

async function readCurrentActivation() {
  const cookieStore = await cookies();
  return readActivationSession(cookieStore.get(ACTIVATION_COOKIE_NAME)?.value);
}

export async function GET() {
  const activation = await readCurrentActivation();
  if (!activation) return error("A ativação não está disponível. Inicie o acesso pelo login.", 401);
  return NextResponse.json({ status: "ready" });
}

export async function POST(request: Request) {
  const activation = await readCurrentActivation();
  if (!activation) return error("A ativação expirou. Informe o código novamente.", 401);

  const body = await request.json().catch(() => null) as { password?: unknown } | null;
  const password = typeof body?.password === "string" ? body.password : "";
  if (password.length < 12) return error("Use uma senha com pelo menos 12 caracteres.");

  const admin = createAdminClient();
  const { data, error: profileError } = await admin
    .from("datarun_user_profiles")
    .select("email, activation_code_hash, activation_code_expires_at, must_set_password")
    .eq("id", activation.userId)
    .maybeSingle();
  const profile = data as ActivationProfile | null;
  if (profileError || !profile || !profile.must_set_password || !profile.activation_code_hash || !activationCodeIsValid(profile.activation_code_expires_at) || !activationHashesMatch(profile.activation_code_hash, activation.codeHash)) {
    return error("A ativação expirou. Informe o código novamente.", 401);
  }

  const { error: passwordError } = await admin.auth.admin.updateUserById(activation.userId, { password });
  if (passwordError) return error("Não foi possível definir a senha agora.", 500);

  const now = new Date().toISOString();
  const { error: completeError } = await admin
    .from("datarun_user_profiles")
    .update({
      must_set_password: false,
      password_set_at: now,
      activation_code_hash: null,
      activation_code_used_at: now,
      activation_code_expires_at: null,
    })
    .eq("id", activation.userId)
    .eq("activation_code_hash", activation.codeHash);
  if (completeError) return error("A senha foi definida, mas não foi possível concluir a ativação.", 500);

  const response = NextResponse.json({ status: "ready", email: profile.email });
  response.cookies.set(ACTIVATION_COOKIE_NAME, "", { httpOnly: true, maxAge: 0, path: "/" });
  return response;
}
