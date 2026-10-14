import { DashboardShell } from "@/components/dashboard-shell";
import { RegistrationContent } from "@/components/dashboard-content";

export default function RegistrationsPage() {
  return <DashboardShell title="Inscrições" description="Acompanhe o ritmo e o perfil das inscrições do evento."><RegistrationContent /></DashboardShell>;
}
