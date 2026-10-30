import { DashboardShell } from "@/components/dashboard-shell";
import { AnalyticsOverview } from "@/components/analytics-overview";
import { requireUser } from "@/lib/auth/require-user";
import { getDashboardData } from "@/lib/dashboard-data";

export default async function Home() {
  const access = await requireUser();
  const data = await getDashboardData();
  return <DashboardShell title="Visão Geral & Correlação" description="Inscrições e divulgação comparadas a partir das bases do DataRun." role={access.role}><AnalyticsOverview data={data} role={access.role} /></DashboardShell>;
}
