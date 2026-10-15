"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import type { DashboardData, DashboardEvent, ValueBreakdown } from "@/lib/dashboard-data";

function formatNumber(value: number) {
  return new Intl.NumberFormat("pt-BR").format(value);
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "short", year: "numeric", timeZone: "UTC" }).format(new Date(`${value}T00:00:00Z`));
}

function statusLabel(status: string) {
  const labels: Record<string, string> = {
    completed: "Concluída",
    completed_with_errors: "Concluída com alertas",
    processing: "Processando",
    pending: "Pendente",
    failed: "Falhou",
  };
  return labels[status] ?? status;
}

function Breakdown({ title, items, emptyText }: { title: string; items: ValueBreakdown[]; emptyText: string }) {
  const total = items.reduce((sum, item) => sum + item.value, 0);
  return <article className="analytics-data-panel"><h2>{title}</h2>{items.length === 0 ? <p className="empty-copy">{emptyText}</p> : <div className="breakdown-list">{items.slice(0, 7).map((item) => <div key={item.label}><span>{item.label}</span><i><b style={{ width: `${total === 0 ? 0 : (item.value / total) * 100}%` }} /></i><strong>{formatNumber(item.value)}</strong></div>)}</div>}</article>;
}

function RegistrationTimeline({ event }: { event: DashboardEvent }) {
  const values = event.dailyRegistrations.slice(-31);
  const maximum = Math.max(...values.map((item) => item.registrations), 1);

  return <section className="correlation-panel registration-timeline-panel">
    <div className="correlation-header"><div><h2><span className="analytics-glyph chart">↗</span> Evolução diária de inscrições</h2><p>Registros recebidos por data de inscrição para o filtro selecionado.</p></div></div>
    {values.length === 0 ? <p className="empty-copy timeline-empty">Nenhuma inscrição disponível para este evento.</p> : <><div className="timeline-summary"><strong>{formatNumber(event.totalRegistrations)}</strong><span>inscrições no total</span><b>{formatCurrency(event.revenue)} em receita confirmada</b></div><div className="registration-timeline" aria-label="Gráfico de inscrições por dia">{values.map((item) => <div className="registration-bar" key={item.date} title={`${formatDate(item.date)}: ${item.registrations} inscrições`}><span style={{ height: `${Math.max((item.registrations / maximum) * 100, 3)}%` }} /><small>{new Date(`${item.date}T00:00:00Z`).getUTCDate()}</small></div>)}</div><div className="timeline-caption"><span>{formatDate(values[0].date)}</span><span>{formatDate(values.at(-1)!.date)}</span></div></>}
  </section>;
}

export function AnalyticsOverview({ data }: { data: DashboardData }) {
  const [activeEventId, setActiveEventId] = useState("all");
  const activeEvent = useMemo(() => activeEventId === "all" ? data.allEvents : data.events.find((event) => event.id === activeEventId) ?? data.allEvents, [activeEventId, data]);
  const latestImport = data.imports[0];

  return <>
    <div className="event-filter-row"><button className={activeEventId === "all" ? "active" : ""} type="button" onClick={() => setActiveEventId("all")}>Todos os eventos ({data.events.length})</button>{data.events.map((event) => <button className={activeEventId === event.id ? "active" : ""} type="button" onClick={() => setActiveEventId(event.id)} key={event.id}>{event.name}</button>)}</div>
    <section className="sync-banner"><span>▣</span><strong>{latestImport ? "Sincronizado" : "Sem importações"}</strong><p>{latestImport ? <>Última base: <b>{latestImport.fileName}</b> ({formatNumber(latestImport.sourceRecordCount)} registros processados)</> : "Importe uma planilha de inscrições para iniciar os indicadores."}</p>{latestImport?.completedAt && <time>{formatDate(latestImport.completedAt.slice(0, 10))}</time>}<Link href="/importacoes"><span className="analytics-glyph upload">↥</span> Importar dados</Link></section>
    <section className="analytics-metrics">
      <article><span>Total de inscrições</span><div><strong>{formatNumber(activeEvent.totalRegistrations)}</strong><i className="up-pill">{activeEvent.name}</i></div><div className="metric-detail"><span>{formatNumber(activeEvent.confirmedRegistrations)} confirmadas</span><b>{formatNumber(activeEvent.paidRegistrations)} pagas</b></div></article>
      <article><span>Receita confirmada</span><div><strong>{formatCurrency(activeEvent.revenue)}</strong><i className="ticket-pill">Pagamentos</i></div><div className="metric-detail"><span>Apenas inscrições confirmadas e pagas</span></div></article>
      <article><span>Ticket médio</span><div><strong className="blue-number">{formatCurrency(activeEvent.averageTicket)}</strong><i className="posts-pill">Média</i></div><div className="metric-detail"><span>Receita dividida por inscrições pagas</span></div></article>
      <article><span>Etapas importadas</span><div><strong>{formatNumber(data.events.length)}</strong><i className="pearson-pill">Ativas</i></div><div className="metric-detail"><span>Base filtrada: {activeEventId === "all" ? "todas as etapas" : activeEvent.name}</span></div></article>
    </section>
    <RegistrationTimeline event={activeEvent} />
    <section className="analytics-data-grid">
      <Breakdown title="Faixas etárias" items={activeEvent.ageRanges} emptyText="Não há datas de nascimento suficientes para gerar faixas etárias." />
      <Breakdown title="Inscrições por lote" items={activeEvent.lots} emptyText="Nenhum lote foi informado na base." />
      <Breakdown title="Inscrições por percurso" items={activeEvent.routes} emptyText="Nenhum percurso foi informado na base." />
    </section>
    <section className="analytics-bottom">
      <section className="impact-table-panel"><div className="section-top"><div><h2>Etapas cadastradas</h2><p>Resumo calculado a partir da base de inscrições importada.</p></div><Link href="/eventos">Ver eventos →</Link></div><div className="impact-scroll"><table className="impact-table"><thead><tr><th>Etapa</th><th>Ano</th><th>Inscrições</th><th>Confirmadas</th><th>Receita</th><th>Ticket médio</th></tr></thead><tbody>{data.events.map((event) => <tr key={event.id}><td><strong>{event.name}</strong></td><td>{event.year}</td><td>{formatNumber(event.totalRegistrations)}</td><td><b>{formatNumber(event.confirmedRegistrations)}</b></td><td>{formatCurrency(event.revenue)}</td><td>{formatCurrency(event.averageTicket)}</td></tr>)}</tbody></table></div></section>
      <aside className="memory-panel"><div className="section-top"><div><h2><span className="analytics-glyph file">▤</span> Importações recentes</h2></div><span className="active-count">{data.imports.length} registro(s)</span></div>{data.imports.length === 0 ? <p className="empty-copy">Nenhum arquivo foi processado.</p> : data.imports.slice(0, 4).map((item) => <div className="memory-file" key={item.id}><div><b>{item.fileName}</b><i>{statusLabel(item.status)}</i></div><p><strong>{formatNumber(item.sourceRecordCount)} linhas</strong> processadas <span>{item.completedAt ? formatDate(item.completedAt.slice(0, 10)) : "em andamento"}</span></p><div className="load-progress"><span /></div></div>)}<Link className="analytics-import-link" href="/importacoes">Abrir importador</Link></aside>
    </section>
  </>;
}
