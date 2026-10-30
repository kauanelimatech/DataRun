"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import type { ContentCategoryImpact, DashboardCorrelation, DashboardData, DashboardEvent, PostCorrelationImpact, ValueBreakdown } from "@/lib/dashboard-data";

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

function formatCorrelation(value: number | null) {
  if (value === null) return "Sem base";
  return `r ${value >= 0 ? "+" : ""}${value.toFixed(2)}`;
}

function correlationDescription(value: number | null) {
  if (value === null) return "Dados sem variação suficiente";
  const strength = Math.abs(value);
  const direction = value >= 0 ? "positiva" : "negativa";
  if (strength >= 0.7) return `Associação ${direction} forte`;
  if (strength >= 0.4) return `Associação ${direction} moderada`;
  return `Associação ${direction} fraca`;
}

function formatSignedNumber(value: number | null) {
  if (value === null) return "—";
  const rounded = Math.round(value * 10) / 10;
  return `${rounded > 0 ? "+" : ""}${new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 1 }).format(rounded)}`;
}

function Breakdown({ title, items, emptyText }: { title: string; items: ValueBreakdown[]; emptyText: string }) {
  const total = items.reduce((sum, item) => sum + item.value, 0);
  return <article className="analytics-data-panel"><h2>{title}</h2>{items.length === 0 ? <p className="empty-copy">{emptyText}</p> : <div className="breakdown-list">{items.slice(0, 7).map((item) => <div key={item.label}><span>{item.label}</span><i><b style={{ width: `${total === 0 ? 0 : (item.value / total) * 100}%` }} /></i><strong>{formatNumber(item.value)}</strong></div>)}</div>}</article>;
}

function CorrelationTimeline({ event, correlation }: { event: DashboardEvent; correlation: DashboardCorrelation }) {
  const values = correlation.daily.slice(-31);
  const maximumRegistrations = Math.max(...values.map((item) => item.registrations), 1);
  const maximumPosts = Math.max(...values.map((item) => item.posts), 1);

  return <section className="correlation-panel registration-timeline-panel">
    <div className="correlation-header"><div><h2><span className="analytics-glyph chart">↗</span> Inscrições diárias × publicações do Instagram</h2><p>Comparação temporal no período de inscrições da etapa selecionada. Publicações não representam conversões atribuídas individualmente.</p></div></div>
    {!correlation.hasComparablePeriod ? <p className="empty-copy timeline-empty">Não há posts publicados dentro do período de inscrições deste recorte. A correlação aparecerá quando as duas fontes tiverem datas em comum.</p> : <><div className="chart-legend correlation-legend"><span><i className="bar-key" />Inscrições por dia</span><span><i className="post-key" />Publicações no Instagram</span><span><i className="line-key" />{formatCorrelation(correlation.correlationWithPosts)}</span></div><div className="timeline-summary"><strong>{formatNumber(event.totalRegistrations)}</strong><span>inscrições no recorte</span><b>{formatNumber(correlation.postCount)} posts no mesmo período</b></div><div className="correlation-timeline" aria-label="Gráfico de inscrições e posts por dia">{values.map((item) => <div className="correlation-day" key={item.date} title={`${formatDate(item.date)}: ${item.registrations} inscrições e ${item.posts} post(s)`}><span className="correlation-registration-bar" style={{ height: `${Math.max((item.registrations / maximumRegistrations) * 100, item.registrations > 0 ? 3 : 0)}%` }} />{item.posts > 0 && <i className="correlation-post-marker" style={{ bottom: `calc(18px + ${Math.max((item.posts / maximumPosts) * 72, 9)}%)` }}><b>{item.posts}</b></i>}<small>{new Date(`${item.date}T00:00:00Z`).getUTCDate()}</small></div>)}</div><div className="timeline-caption"><span>{formatDate(values[0].date)}</span><span>{formatDate(values.at(-1)!.date)}</span></div></>}
  </section>;
}

function CategoryImpactTable({ items }: { items: ContentCategoryImpact[] }) {
  return <section className="impact-table-panel social-impact-panel"><div className="section-top"><div><h2>Resposta por categoria de conteúdo</h2><p>Média de inscrições no dia do post e no dia seguinte, comparada aos sete dias anteriores.</p></div></div>{items.length === 0 ? <p className="empty-copy">Não há publicações no período de inscrições deste recorte.</p> : <div className="impact-scroll"><table className="impact-table"><thead><tr><th>Categoria</th><th>Posts</th><th>Engajamento</th><th>Insc. D0–D1</th><th>Variação</th></tr></thead><tbody>{items.slice(0, 8).map((item) => <tr key={item.name}><td><strong>{item.name}</strong></td><td>{formatNumber(item.postCount)}</td><td>{formatNumber(item.engagement)}</td><td><b>{formatSignedNumber(item.averageRegistrations24h)}</b></td><td className={item.averageRegistrationLift24h !== null && item.averageRegistrationLift24h > 0 ? "positive-cell" : ""}>{formatSignedNumber(item.averageRegistrationLift24h)}</td></tr>)}</tbody></table></div>}</section>;
}

function PostImpactTable({ posts }: { posts: PostCorrelationImpact[] }) {
  return <section className="impact-table-panel social-impact-panel"><div className="section-top"><div><h2>Posts com maior associação temporal</h2><p>Ordenados pela variação de inscrições após a publicação; não representa causalidade.</p></div><Link href="/divulgacao">Ver posts →</Link></div>{posts.length === 0 ? <p className="empty-copy">Ainda não há posts no intervalo para comparar.</p> : <div className="impact-scroll"><table className="impact-table"><thead><tr><th>Post</th><th>Categoria</th><th>Data</th><th>Insc. D0–D1</th><th>Variação</th></tr></thead><tbody>{posts.map((post) => <tr key={post.id}><td>{post.permalink ? <a className="post-impact-link" href={post.permalink} target="_blank" rel="noreferrer">{post.caption?.slice(0, 56) || post.mediaType} ↗</a> : <strong>{post.caption?.slice(0, 56) || post.mediaType}</strong>}</td><td>{post.categoryName}</td><td>{formatDate(post.publishedDate)}</td><td><b>{formatNumber(post.registrations24h)}</b></td><td className={post.registrationLift24h !== null && post.registrationLift24h > 0 ? "positive-cell" : ""}>{formatSignedNumber(post.registrationLift24h)}</td></tr>)}</tbody></table></div>}</section>;
}

export function AnalyticsOverview({ data, role }: { data: DashboardData; role: "ADMINISTRATOR" | "ORGANIZER" }) {
  const [activeEventId, setActiveEventId] = useState("all");
  const activeEvent = useMemo(() => activeEventId === "all" ? data.allEvents : data.events.find((event) => event.id === activeEventId) ?? data.allEvents, [activeEventId, data]);
  const activeCorrelation = data.correlations[activeEventId] ?? data.correlations.all;
  const latestImport = data.imports[0];
  const canManage = role === "ADMINISTRATOR";

  return <>
    <div className="event-filter-row"><button className={activeEventId === "all" ? "active" : ""} type="button" onClick={() => setActiveEventId("all")}>Todos os eventos ({data.events.length})</button>{data.events.map((event) => <button className={activeEventId === event.id ? "active" : ""} type="button" onClick={() => setActiveEventId(event.id)} key={event.id}>{event.name}</button>)}</div>
    <section className="sync-banner"><span>▣</span><strong>{latestImport ? "Sincronizado" : "Sem importações"}</strong><p>{latestImport ? <>Última base: <b>{latestImport.fileName}</b> ({formatNumber(latestImport.sourceRecordCount)} registros processados)</> : "A base de inscrições ainda não possui importações."}</p>{latestImport?.completedAt && <time>{formatDate(latestImport.completedAt.slice(0, 10))}</time>}{canManage ? <Link href="/importacoes"><span className="analytics-glyph upload">↥</span> Importar dados</Link> : <small>Somente visualização</small>}</section>
    <section className="analytics-metrics">
      <article><span>Total de inscrições</span><div><strong>{formatNumber(activeEvent.totalRegistrations)}</strong><i className="up-pill">{activeEvent.name}</i></div><div className="metric-detail"><span>{formatNumber(activeEvent.confirmedRegistrations)} confirmadas</span><b>{formatNumber(activeEvent.paidRegistrations)} pagas</b></div></article>
      <article className="correlation-metric"><span>Correlação com posts</span><div><strong>{formatCorrelation(activeCorrelation.correlationWithPosts)}</strong><i className="pearson-pill">Pearson</i></div><div className="metric-detail"><span>{correlationDescription(activeCorrelation.correlationWithPosts)}</span><b>{formatNumber(activeCorrelation.postCount)} posts · engajamento {formatCorrelation(activeCorrelation.correlationWithEngagement)}</b></div></article>
      <article><span>Engajamento Instagram</span><div><strong className="blue-number">{formatNumber(activeCorrelation.engagement)}</strong><i className="posts-pill">Interações</i></div><div className="metric-detail"><span>{formatNumber(activeCorrelation.reach)} de alcance disponível</span></div></article>
      <article><span>Receita confirmada</span><div><strong>{formatCurrency(activeEvent.revenue)}</strong><i className="ticket-pill">Pagamentos</i></div><div className="metric-detail"><span>Ticket médio: {formatCurrency(activeEvent.averageTicket)}</span></div></article>
    </section>
    <CorrelationTimeline event={activeEvent} correlation={activeCorrelation} />
    <section className="analytics-data-grid">
      <Breakdown title="Faixas etárias" items={activeEvent.ageRanges} emptyText="Não há datas de nascimento suficientes para gerar faixas etárias." />
      <Breakdown title="Inscrições por lote" items={activeEvent.lots} emptyText="Nenhum lote foi informado na base." />
      <Breakdown title="Inscrições por percurso" items={activeEvent.routes} emptyText="Nenhum percurso foi informado na base." />
    </section>
    <section className="analytics-bottom social-comparison-grid">
      <CategoryImpactTable items={activeCorrelation.categoryImpacts} />
      <PostImpactTable posts={activeCorrelation.topPostImpacts} />
    </section>
    <section className="correlation-methodology"><span>i</span><div><strong>Como a comparação é calculada</strong><p>O DataRun compara as inscrições diárias com posts publicados no mesmo intervalo. Como as inscrições são importadas por data, a variação usa o dia de publicação e o dia seguinte, comparados à média dos sete dias anteriores. Esses indicadores apontam associação temporal e ajudam a investigar resultados; não comprovam que um post causou uma inscrição.</p></div></section>
    <section className="analytics-bottom">
      <section className="impact-table-panel"><div className="section-top"><div><h2>Etapas cadastradas</h2><p>Resumo calculado a partir da base de inscrições importada.</p></div><Link href="/eventos">Ver eventos →</Link></div><div className="impact-scroll"><table className="impact-table"><thead><tr><th>Etapa</th><th>Ano</th><th>Inscrições</th><th>Confirmadas</th><th>Receita</th><th>Ticket médio</th></tr></thead><tbody>{data.events.map((event) => <tr key={event.id}><td><strong>{event.name}</strong></td><td>{event.year}</td><td>{formatNumber(event.totalRegistrations)}</td><td><b>{formatNumber(event.confirmedRegistrations)}</b></td><td>{formatCurrency(event.revenue)}</td><td>{formatCurrency(event.averageTicket)}</td></tr>)}</tbody></table></div></section>
      <aside className="memory-panel"><div className="section-top"><div><h2><span className="analytics-glyph file">▤</span> Importações recentes</h2></div><span className="active-count">{data.imports.length} registro(s)</span></div>{data.imports.length === 0 ? <p className="empty-copy">Nenhum arquivo foi processado.</p> : data.imports.slice(0, 4).map((item) => <div className="memory-file" key={item.id}><div><b>{item.fileName}</b><i>{statusLabel(item.status)}</i></div><p><strong>{formatNumber(item.sourceRecordCount)} linhas</strong> processadas <span>{item.completedAt ? formatDate(item.completedAt.slice(0, 10)) : "em andamento"}</span></p><div className="load-progress"><span /></div></div>)}{canManage && <Link className="analytics-import-link" href="/importacoes">Abrir importador</Link>}</aside>
    </section>
  </>;
}
