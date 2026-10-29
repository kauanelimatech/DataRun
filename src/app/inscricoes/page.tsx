import { DashboardShell } from "@/components/dashboard-shell";
import { requireUser } from "@/lib/auth/require-user";
import { getDashboardData } from "@/lib/dashboard-data";

function formatCurrency(value: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);
}

function BreakdownTable({ title, items }: { title: string; items: { label: string; value: number }[] }) {
  return <article className="panel registration-breakdown"><div className="panel-heading"><div><h2>{title}</h2><p>Dados agregados; nenhum participante é exibido.</p></div></div>{items.length === 0 ? <p className="empty-copy">Sem dados disponíveis.</p> : <div className="table-scroll"><table><thead><tr><th>Categoria</th><th>Inscrições</th></tr></thead><tbody>{items.map((item) => <tr key={item.label}><td><strong>{item.label}</strong></td><td>{item.value.toLocaleString("pt-BR")}</td></tr>)}</tbody></table></div>}</article>;
}

export default async function RegistrationsPage() {
  const access = await requireUser();
  const { allEvents, events } = await getDashboardData();

  return <DashboardShell title="Inscrições" description="Acompanhamento consolidado e sem identificação individual de participantes." role={access.role}>
    <section className="analytics-metrics registration-metrics"><article><span>Total importado</span><div><strong>{allEvents.totalRegistrations.toLocaleString("pt-BR")}</strong><i className="up-pill">Registros</i></div><div className="metric-detail"><span>{events.length} etapa(s) na base</span></div></article><article><span>Confirmadas</span><div><strong>{allEvents.confirmedRegistrations.toLocaleString("pt-BR")}</strong><i className="pearson-pill">Status</i></div><div className="metric-detail"><span>Inscrições com status confirmada</span></div></article><article><span>Pagas</span><div><strong>{allEvents.paidRegistrations.toLocaleString("pt-BR")}</strong><i className="posts-pill">Compra</i></div><div className="metric-detail"><span>Confirmadas com pagamento identificado</span></div></article><article><span>Receita confirmada</span><div><strong>{formatCurrency(allEvents.revenue)}</strong><i className="ticket-pill">Receita</i></div><div className="metric-detail"><span>Ticket médio: {formatCurrency(allEvents.averageTicket)}</span></div></article></section>
    <section className="registration-breakdown-grid"><BreakdownTable title="Faixas etárias" items={allEvents.ageRanges} /><BreakdownTable title="Percursos" items={allEvents.routes} /><BreakdownTable title="Lotes" items={allEvents.lots} /></section>
    <article className="panel table-panel"><div className="panel-heading"><div><h2>Resumo por etapa</h2><p>Totais agregados por etapa de origem.</p></div></div><div className="table-scroll"><table><thead><tr><th>Etapa</th><th>Ano</th><th>Total</th><th>Confirmadas</th><th>Receita</th></tr></thead><tbody>{events.map((event) => <tr key={event.id}><td><strong>{event.name}</strong></td><td>{event.year}</td><td>{event.totalRegistrations.toLocaleString("pt-BR")}</td><td>{event.confirmedRegistrations.toLocaleString("pt-BR")}</td><td>{formatCurrency(event.revenue)}</td></tr>)}</tbody></table></div></article>
  </DashboardShell>;
}
