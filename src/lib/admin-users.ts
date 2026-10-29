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
  activation_code_created_at: string | null;
  activation_code_expires_at: string | null;
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
  activationCodeCreatedAt: string | null;
  activationCodeExpiresAt: string | null;
  createdAt: string;
};

export async function getManagedDashboardUsers(): Promise<ManagedDashboardUser[]> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("datarun_user_profiles")
    .select("id, email, role, must_set_password, invited_at, password_reset_at, password_set_at, activation_code_created_at, activation_code_expires_at, created_at")
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
    activationCodeCreatedAt: user.activation_code_created_at,
    activationCodeExpiresAt: user.activation_code_expires_at,
    createdAt: user.created_at,
  }));
}
