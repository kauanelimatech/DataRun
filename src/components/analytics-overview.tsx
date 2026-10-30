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

type TimelineDisplayPoint = {
  startDate: string;
  endDate: string;
  registrations: number;
  posts: number;
};

type TimelineReference = {
  date: string;
  label: string;
  kind: "business-day" | "lot-deadline";
};

function isoDate(value: Date) {
  return value.toISOString().slice(0, 10);
}

function addUtcDays(value: Date, days: number) {
  const copy = new Date(value);
  copy.setUTCDate(copy.getUTCDate() + days);
  return copy;
}

function easterSunday(year: number) {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31) - 1;
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(Date.UTC(year, month, day));
}

function nationalHolidays(year: number) {
  const fixed = ["01-01", "04-21", "05-01", "09-07", "10-12", "11-02", "11-15", "11-20", "12-25"];
  const goodFriday = isoDate(addUtcDays(easterSunday(year), -2));
  return new Set([...fixed.map((monthDay) => `${year}-${monthDay}`), goodFriday]);
}

function fifthBusinessDays(startDate: string, endDate: string): TimelineReference[] {
  const start = new Date(`${startDate}T00:00:00Z`);
  const end = new Date(`${endDate}T00:00:00Z`);
  const references: TimelineReference[] = [];
  const month = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), 1));
  const lastMonth = new Date(Date.UTC(end.getUTCFullYear(), end.getUTCMonth(), 1));

  while (month <= lastMonth) {
    const holidays = nationalHolidays(month.getUTCFullYear());
    let businessDays = 0;
    for (let day = 1; day <= 31; day += 1) {
      const candidate = new Date(Date.UTC(month.getUTCFullYear(), month.getUTCMonth(), day));
      if (candidate.getUTCMonth() !== month.getUTCMonth()) break;
      const date = isoDate(candidate);
      const weekday = candidate.getUTCDay();
      if (weekday === 0 || weekday === 6 || holidays.has(date)) continue;
      businessDays += 1;
      if (businessDays === 5) {
        if (date >= startDate && date <= endDate) references.push({ date, label: "5º dia útil", kind: "business-day" });
        break;
      }
    }
    month.setUTCMonth(month.getUTCMonth() + 1);
  }
  return references;
}

function timelinePoints(values: DashboardCorrelation["daily"]): TimelineDisplayPoint[] {
  if (values.length <= 90) return values.map((value) => ({ ...value, startDate: value.date, endDate: value.date }));

  if (values.length <= 730) {
    const points: TimelineDisplayPoint[] = [];
    for (let index = 0; index < values.length; index += 7) {
      const group = values.slice(index, index + 7);
      points.push({
        startDate: group[0].date,
        endDate: group.at(-1)!.date,
        registrations: group.reduce((total, value) => total + value.registrations, 0),
        posts: group.reduce((total, value) => total + value.posts, 0),
      });
    }
    return points;
  }

  const monthly = new Map<string, TimelineDisplayPoint>();
  values.forEach((value) => {
    const key = value.date.slice(0, 7);
    const current = monthly.get(key) ?? { startDate: value.date, endDate: value.date, registrations: 0, posts: 0 };
    current.endDate = value.date;
    current.registrations += value.registrations;
    current.posts += value.posts;
    monthly.set(key, current);
  });
  return Array.from(monthly.values());
}

function timelineLabel(point: TimelineDisplayPoint, numberOfPoints: number) {
  if (numberOfPoints > 40) return "";
  return new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: numberOfPoints > 16 ? "short" : undefined, timeZone: "UTC" }).format(new Date(`${point.startDate}T00:00:00Z`));
}

function CorrelationTimeline({ event, correlation, lotDeadlines }: { event: DashboardEvent; correlation: DashboardCorrelation; lotDeadlines: TimelineReference[] }) {
  const values = timelinePoints(correlation.daily);
  const maximumRegistrations = Math.max(...values.map((item) => item.registrations), 1);
  const maximumPosts = Math.max(...values.map((item) => item.posts), 1);
  const isAllEvents = event.id === "all";
  const references = correlation.startDate && correlation.endDate
    ? [...fifthBusinessDays(correlation.startDate, correlation.endDate), ...lotDeadlines.filter((deadline) => deadline.date >= correlation.startDate! && deadline.date <= correlation.endDate!)]
    : [];

  return <section className="correlation-panel registration-timeline-panel">
    <div className="correlation-header"><div><h2><span className="analytics-glyph chart">↗</span> Inscrições diárias × publicações do Instagram</h2><p>{isAllEvents ? "No consolidado, o gráfico usa somente o período em comum entre a primeira e a última inscrição e o primeiro e o último post." : "A etapa selecionada é exibida da primeira à última inscrição; posts fora desse intervalo não entram na comparação."}</p></div></div>
    {values.length === 0 ? <p className="empty-copy timeline-empty">Não há período em comum entre inscrições e posts neste recorte. Selecione uma etapa para ver toda a sua linha do tempo de inscrições.</p> : <><div className="chart-legend correlation-legend"><span><i className="bar-key" />Inscrições por período</span><span><i className="post-key" />Publicações no Instagram</span><span><i className="business-day-key" />5º dia útil</span><span><i className="lot-deadline-key" />Fim do 1º lote</span><span><i className="line-key" />{formatCorrelation(correlation.correlationWithPosts)}</span></div><div className="timeline-summary"><strong>{formatNumber(event.totalRegistrations)}</strong><span>inscrições no recorte</span><b>{formatNumber(correlation.postCount)} posts no mesmo período</b></div><div className="correlation-timeline" aria-label="Gráfico de inscrições e posts por período">{values.map((item) => { const markers = references.filter((reference) => reference.date >= item.startDate && reference.date <= item.endDate); return <div className="correlation-day" key={`${item.startDate}-${item.endDate}`} title={`${formatDate(item.startDate)}${item.startDate === item.endDate ? "" : ` a ${formatDate(item.endDate)}`}: ${item.registrations} inscrições e ${item.posts} post(s)`}><span className="correlation-registration-bar" style={{ height: `${Math.max((item.registrations / maximumRegistrations) * 100, item.registrations > 0 ? 3 : 0)}%` }} />{markers.map((marker, index) => <i className={`timeline-reference-marker ${marker.kind}`} key={`${marker.kind}-${marker.date}`} style={{ top: `${8 + index * 15}px` }} title={`${marker.label}: ${formatDate(marker.date)}`} />)}{item.posts > 0 && <i className="correlation-post-marker" style={{ bottom: `calc(18px + ${Math.max((item.posts / maximumPosts) * 72, 9)}%)` }}><b>{item.posts}</b></i>}<small>{timelineLabel(item, values.length)}</small></div>; })}</div><div className="timeline-caption"><span>{formatDate(correlation.startDate!)}</span><span>{formatDate(correlation.endDate!)}</span></div></>}
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
  const lotDeadlines = useMemo<TimelineReference[]>(() => (activeEventId === "all" ? data.events : [activeEvent])
    .flatMap((event) => event.firstLotEndsOn ? [{ date: event.firstLotEndsOn, label: `Fim do 1º lote: ${event.name}`, kind: "lot-deadline" as const }] : []), [activeEvent, activeEventId, data.events]);
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
    <CorrelationTimeline event={activeEvent} correlation={activeCorrelation} lotDeadlines={lotDeadlines} />
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
