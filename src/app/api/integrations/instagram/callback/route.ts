import { timingSafeEqual } from "node:crypto";

import { NextResponse } from "next/server";
import { encryptInstagramToken, exchangeInstagramAuthorizationCode, getInstagramAccount } from "@/lib/instagram/oauth";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function statesMatch(expected: string | undefined, received: string | null) {
  if (!expected || !received) return false;
  const expectedBuffer = Buffer.from(expected);
  const receivedBuffer = Buffer.from(received);
  return expectedBuffer.length === receivedBuffer.length && timingSafeEqual(expectedBuffer, receivedBuffer);
}

function redirectToOutreach(request: Request, result: string) {
  const response = NextResponse.redirect(new URL(`/divulgacao?instagram=${result}`, request.url));
  response.cookies.set("datarun_instagram_oauth_state", "", { httpOnly: true, maxAge: 0, path: "/" });
  return response;
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const state = url.searchParams.get("state");
  const code = url.searchParams.get("code");
  const error = url.searchParams.get("error");
  const expectedState = request.headers.get("cookie")
    ?.split(";")
    .map((value) => value.trim())
    .find((value) => value.startsWith("datarun_instagram_oauth_state="))
    ?.slice("datarun_instagram_oauth_state=".length);

  if (error || !code || !statesMatch(expectedState, state)) return redirectToOutreach(request, "authorization-error");

  const supabase = await createClient();
  const { data, error: authError } = await supabase.auth.getClaims();
  const userId = typeof data?.claims?.sub === "string" ? data.claims.sub : null;
  if (authError || !userId) return redirectToOutreach(request, "authorization-error");

  try {
    const token = await exchangeInstagramAuthorizationCode(code);
    const account = await getInstagramAccount(token.accessToken, token.userId);
    const expiresAt = token.expiresIn ? new Date(Date.now() + token.expiresIn * 1000).toISOString() : null;
    const admin = createAdminClient();
    const { error: saveError } = await admin
      .from("instagram_connections")
      .upsert({
        instagram_user_id: account.userId,
        instagram_username: account.username,
        access_token_encrypted: encryptInstagramToken(token.accessToken),
        token_expires_at: expiresAt,
        granted_scopes: token.scopes,
        status: "connected",
        connected_by: userId,
        connected_at: new Date().toISOString(),
        last_sync_error: null,
      }, { onConflict: "instagram_user_id" });
    if (saveError) throw new Error("Não foi possível salvar a conexão autorizada.");
    return redirectToOutreach(request, "connected");
  } catch {
    return redirectToOutreach(request, "connection-error");
  }
}
