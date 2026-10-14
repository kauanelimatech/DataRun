import { DashboardShell } from "@/components/dashboard-shell";
import { AnalyticsOverview } from "@/components/analytics-overview";

export default function Home() {
  return <DashboardShell title="Visão Geral & Correlação Analítica" description="Algoritmo de Atribuição Ponderada Ativo"><AnalyticsOverview /></DashboardShell>;
}
