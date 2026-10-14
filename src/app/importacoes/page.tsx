import { DashboardShell } from "@/components/dashboard-shell";
import { ImportsContent } from "@/components/dashboard-content";

export default function ImportsPage() {
  return <DashboardShell title="Importações" description="Envie e acompanhe os dados que alimentam seus indicadores."><ImportsContent /></DashboardShell>;
}
