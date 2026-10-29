import { getApiUserAccess } from "@/lib/auth/access";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const access = await getApiUserAccess();
  if (!access) return Response.json({ error: "Faça login para concluir a definição da senha." }, { status: 401 });

  const body = await request.json().catch(() => null) as { password?: unknown } | null;
  const password = typeof body?.password === "string" ? body.password : "";
  if (password.length < 12) return Response.json({ error: "Use uma senha com pelo menos 12 caracteres." }, { status: 400 });

  const admin = createAdminClient();
  const { error: passwordError } = await admin.auth.admin.updateUserById(access.id, { password });
  if (passwordError) return Response.json({ error: "Não foi possível atualizar a senha." }, { status: 500 });

  const { error: profileError } = await admin
    .from("datarun_user_profiles")
    .update({
      must_set_password: false,
      password_set_at: new Date().toISOString(),
    })
    .eq("id", access.id);

  if (profileError) return Response.json({ error: "A senha foi atualizada, mas não foi possível concluir o acesso ao painel." }, { status: 500 });

  return Response.json({ status: "ready" });
}
