import { DashboardShell } from "@/components/dashboard-shell";
import { OutreachContent } from "@/components/dashboard-content";

export default function OutreachPage() {
  return <DashboardShell title="Divulgação" description="Visualize as métricas de comunicação junto à evolução das inscrições."><OutreachContent /></DashboardShell>;
}
