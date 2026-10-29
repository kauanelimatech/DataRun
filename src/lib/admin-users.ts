import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import type { DashboardRole } from "@/lib/auth/access";

type UserProfileRow = {
  id: string;
  email: string;
  role: DashboardRole;
  must_set_password: boolean;
  invited_at: string | null;
  password_reset_at: string | null;
  password_set_at: string | null;
  access_link_created_at: string | null;
  created_at: string;
};

export type ManagedDashboardUser = {
  id: string;
  email: string;
  role: DashboardRole;
  mustSetPassword: boolean;
  invitedAt: string | null;
  passwordResetAt: string | null;
  passwordSetAt: string | null;
  accessLinkCreatedAt: string | null;
  createdAt: string;
};

export async function getManagedDashboardUsers(): Promise<ManagedDashboardUser[]> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("datarun_user_profiles")
    .select("id, email, role, must_set_password, invited_at, password_reset_at, password_set_at, access_link_created_at, created_at")
    .order("created_at", { ascending: true });

  if (error) throw new Error("Não foi possível carregar os acessos do painel.");

  return ((data ?? []) as UserProfileRow[]).map((user) => ({
    id: user.id,
    email: user.email,
    role: user.role,
    mustSetPassword: user.must_set_password,
    invitedAt: user.invited_at,
    passwordResetAt: user.password_reset_at,
    passwordSetAt: user.password_set_at,
    accessLinkCreatedAt: user.access_link_created_at,
    createdAt: user.created_at,
  }));
}
