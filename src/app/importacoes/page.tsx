import { DashboardShell } from "@/components/dashboard-shell";
import { RegistrationImportForm } from "@/components/registration-import-form";
import { requireUser } from "@/lib/auth/require-user";

export default async function ImportsPage() {
  await requireUser();
  return <DashboardShell title="Importar inscrições" description="Valide e atualize a base que alimenta os indicadores do evento."><RegistrationImportForm /></DashboardShell>;
}
