import { DashboardShell } from "@/components/dashboard-shell";
import { ReportsContent } from "@/components/dashboard-content";

export default function ReportsPage() {
  return <DashboardShell title="Relatórios" description="Acesse visões prontas para acompanhar os resultados do evento."><ReportsContent /></DashboardShell>;
}
