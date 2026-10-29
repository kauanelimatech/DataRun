import { DashboardShell } from "@/components/dashboard-shell";
import { UserAccessManagement } from "@/components/user-access-management";
import { requireAdministrator } from "@/lib/auth/access";
import { getManagedDashboardUsers } from "@/lib/admin-users";

export default async function UsersPage() {
  const access = await requireAdministrator();
  const users = await getManagedDashboardUsers();

  return (
    <DashboardShell
      title="Acessos do painel"
      description="Convites, níveis de permissão e redefinição de senha."
      role={access.role}
    >
      <UserAccessManagement users={users} />
    </DashboardShell>
  );
}
