import Link from "next/link";
import { DashboardShell } from "@/components/dashboard-shell";
import { requireUser } from "@/lib/auth/require-user";
import { getDashboardData } from "@/lib/dashboard-data";

export default async function ReportsPage() {
  await requireUser();
  const { allEvents, events } = await getDashboardData();
  return <DashboardShell title="Relatórios" description="Visões consolidadas a partir das bases já processadas."><section className="report-grid"><article className="report-card"><div className="report-icon">▤</div><span>Dados atuais</span><h2>Resumo de inscrições</h2><p>{allEvents.totalRegistrations.toLocaleString("pt-BR")} inscrições consolidadas em {events.length} etapa(s), sem dados que identifiquem participantes.</p><Link className="outline-button" href="/inscricoes">Abrir visão</Link></article><article className="report-card"><div className="report-icon">↗</div><span>Dados atuais</span><h2>Receita por etapa</h2><p>Consulte receita confirmada, ticket médio e situação das inscrições por etapa.</p><Link className="outline-button" href="/">Abrir visão</Link></article><article className="report-card"><div className="report-icon">◌</div><span>Aguardando fonte</span><h2>Divulgação e conversão</h2><p>Será disponibilizado após a importação das métricas do Instagram.</p><Link className="outline-button" href="/divulgacao">Ver status</Link></article></section></DashboardShell>;
}
