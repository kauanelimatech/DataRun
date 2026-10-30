import { DashboardShell } from "@/components/dashboard-shell";
import { DeleteEventButton } from "@/components/delete-event-button";
import { FirstLotDeadlineForm } from "@/components/first-lot-deadline-form";
import { requireUser } from "@/lib/auth/require-user";
import { getDashboardData } from "@/lib/dashboard-data";

function formatDate(value: string | null) {
  if (!value) return "Data do evento não informada";
  return new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "short", year: "numeric", timeZone: "UTC" }).format(new Date(`${value}T00:00:00Z`));
}

export default async function EventsPage() {
  const access = await requireUser();
  const { events } = await getDashboardData();

  return <DashboardShell title="Eventos e etapas" description="Etapas identificadas automaticamente a partir das planilhas importadas." role={access.role}>
    <div className="event-page-action"><p>{events.length === 0 ? "Nenhuma etapa foi encontrada. Importe uma planilha de inscrições para começar." : `${events.length} etapa(s) cadastrada(s) na base atual.`}</p></div>
    <section className="event-grid">{events.map((event) => <article className="event-card" key={event.id}><div className="event-card-top"><span className={event.totalRegistrations > 0 ? "open-status" : "closed-status"}>{event.totalRegistrations > 0 ? "Base importada" : "Sem inscrições"}</span></div><h2>{event.name} <span>{event.year}</span></h2><p>{formatDate(event.eventDate)}</p><p>{event.stage ?? "Etapa não informada"}</p>{event.firstLotEndsOn && <p className="first-lot-reference">1º lote até {formatDate(event.firstLotEndsOn)}</p>}{access.role === "ADMINISTRATOR" && <FirstLotDeadlineForm eventId={event.id} initialDate={event.firstLotEndsOn} />}<div className="event-card-footer"><span><strong>{event.totalRegistrations.toLocaleString("pt-BR")}</strong><span> inscrições</span></span>{access.role === "ADMINISTRATOR" && <DeleteEventButton eventId={event.id} eventName={event.name} registrationCount={event.totalRegistrations} />}</div></article>)}</section>
  </DashboardShell>;
}
