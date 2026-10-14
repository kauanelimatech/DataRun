import { DashboardShell } from "@/components/dashboard-shell";
import { events } from "@/lib/mock-data";

export default function EventsPage() {
  return <DashboardShell title="Eventos" description="Organize as edições usadas para acompanhar os indicadores.">
    <div className="event-page-action"><p>Os eventos apresentados abaixo são demonstrativos.</p><button className="primary-button" type="button">Adicionar evento</button></div>
    <section className="event-grid">{events.map((event) => <article className="event-card" key={`${event.name}-${event.edition}`}><div className="event-card-top"><span className={event.status === "Inscrições abertas" ? "open-status" : "closed-status"}>{event.status}</span><button type="button" aria-label={`Opções para ${event.name}`}>•••</button></div><h2>{event.name} <span>{event.edition}</span></h2><p>{event.date}</p><p>{event.place}</p><div><strong>{event.total.toLocaleString("pt-BR")}</strong><span> inscrições</span></div></article>)}</section>
  </DashboardShell>;
}
