import { DashboardShell } from "@/components/dashboard-shell";
import { AnalyticsOverview } from "@/components/analytics-overview";
import { requireUser } from "@/lib/auth/require-user";
import { getDashboardData } from "@/lib/dashboard-data";

export default async function Home() {
  const access = await requireUser();
  const data = await getDashboardData();
  return <DashboardShell title="Visão geral de inscrições" description="Indicadores calculados a partir das bases importadas." role={access.role}><AnalyticsOverview data={data} /></DashboardShell>;
}
