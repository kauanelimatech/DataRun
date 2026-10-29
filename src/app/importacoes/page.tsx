import { DashboardShell } from "@/components/dashboard-shell";
import { RegistrationImportForm } from "@/components/registration-import-form";
import { requireAdministrator } from "@/lib/auth/access";

export default async function ImportsPage() {
  const access = await requireAdministrator();
  return <DashboardShell title="Importar inscrições" description="Valide e atualize a base que alimenta os indicadores do evento." role={access.role}><RegistrationImportForm /></DashboardShell>;
}
