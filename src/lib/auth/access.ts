import "server-only";

import { redirect } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export type DashboardRole = "ADMINISTRATOR" | "ORGANIZER";

export type UserAccess = {
  id: string;
  email: string;
  role: DashboardRole;
  mustSetPassword: boolean;
};

type AccessProfile = {
  id: string;
  email: string;
  role: string;
  must_set_password: boolean;
};

export function isAdministrator(access: UserAccess | null | undefined): access is UserAccess & { role: "ADMINISTRATOR" } {
  return access?.role === "ADMINISTRATOR";
}

export async function getApiUserAccess(): Promise<UserAccess | null> {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getClaims();
  const userId = typeof data?.claims?.sub === "string" ? data.claims.sub : null;

  if (error || !userId) return null;

  const admin = createAdminClient();
  const { data: profile, error: profileError } = await admin
    .from("datarun_user_profiles")
    .select("id, email, role, must_set_password")
    .eq("id", userId)
    .maybeSingle();

  if (profileError || !profile) return null;
  const access = profile as AccessProfile;
  if (access.role !== "ADMINISTRATOR" && access.role !== "ORGANIZER") return null;

  return {
    id: access.id,
    email: access.email,
    role: access.role,
    mustSetPassword: access.must_set_password,
  };
}

export async function requireUser(): Promise<UserAccess> {
  const access = await getApiUserAccess();
  if (!access) redirect("/login");
  if (access.mustSetPassword) redirect("/atualizar-senha");
  return access;
}

export async function requireAdministrator(): Promise<UserAccess & { role: "ADMINISTRATOR" }> {
  const access = await requireUser();
  if (!isAdministrator(access)) redirect("/");
  return access;
}
