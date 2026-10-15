import { randomBytes } from "node:crypto";

import { NextResponse } from "next/server";
import { createInstagramAuthorizationUrl } from "@/lib/instagram/oauth";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getClaims();
  if (error || typeof data?.claims?.sub !== "string") {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  try {
    const state = randomBytes(32).toString("base64url");
    const response = NextResponse.redirect(createInstagramAuthorizationUrl(state));
    response.cookies.set("datarun_instagram_oauth_state", state, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      maxAge: 10 * 60,
      path: "/",
    });
    return response;
  } catch {
    return NextResponse.redirect(new URL("/divulgacao?instagram=configuration-error", request.url));
  }
}
