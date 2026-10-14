import { ReactNode } from "react";
import { campaigns, importHistory, recentRegistrations, registrationSegments, registrationTrend } from "@/lib/mock-data";

function MiniTrend({ values, tone = "blue" }: { values: number[]; tone?: "blue" | "purple" | "teal" }) {
  const width = 96;
  const height = 34;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const points = values.map((value, index) => {
    const x = (index / (values.length - 1)) * width;
    const y = height - 4 - ((value - min) / Math.max(max - min, 1)) * (height - 9);
    return `${x},${y}`;
  }).join(" ");
  return <svg className={`mini-trend ${tone}`} viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none" aria-hidden="true"><polyline points={points} /></svg>;
}

export function MetricCard({ label, value, change, note, trend, tone = "blue" }: { label: string; value: string; change: string; note: string; trend: number[]; tone?: "blue" | "purple" | "teal" }) {
  return (
    <article className="metric-card">
      <div className="metric-card-top"><span>{label}</span><button type="button" aria-label={`Mais informações sobre ${label}`}>•••</button></div>
      <div className="metric-value">{value}</div>
      <div className="metric-bottom"><div><span className={`metric-change ${change.startsWith("+") ? "positive" : "neutral"}`}>{change}</span><span className="metric-note">{note}</span></div><MiniTrend values={trend} tone={tone} /></div>
    </article>
  );
}

function RegistrationChart() {
  const width = 720;
  const height = 248;
  const paddingX = 20;
  const paddingTop = 18;
  const paddingBottom = 38;
  const max = 600;
  const graphHeight = height - paddingTop - paddingBottom;
  const points = registrationTrend.map((point, index) => {
    const x = paddingX + (index / (registrationTrend.length - 1)) * (width - paddingX * 2);
    const y = paddingTop + graphHeight - (point.value / max) * graphHeight;
    return { x, y, ...point };
  });
  const line = points.map((point) => `${point.x},${point.y}`).join(" ");
  const area = `${paddingX},${height - paddingBottom} ${line} ${width - paddingX},${height - paddingBottom}`;
  const yTicks = [0, 150, 300, 450, 600];

  return (
    <div className="chart-wrap">
      <svg className="registration-chart" viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none" role="img" aria-label="Evolução acumulada de inscrições em junho">
        <defs><linearGradient id="registration-area" x1="0" x2="0" y1="0" y2="1"><stop offset="0%" stopColor="#3874ff" stopOpacity=".20" /><stop offset="100%" stopColor="#3874ff" stopOpacity="0" /></linearGradient></defs>
        {yTicks.map((tick) => {
          const y = paddingTop + graphHeight - (tick / max) * graphHeight;
          return <g key={tick}><line x1={paddingX} y1={y} x2={width - paddingX} y2={y} className="chart-gridline" /><text x="0" y={y + 4} className="chart-y-label">{tick}</text></g>;
        })}
        <polygon points={area} fill="url(#registration-area)" />
        <polyline points={line} className="chart-line" />
        {points.map((point, index) => <g key={point.label}><circle cx={point.x} cy={point.y} r={index === points.length - 1 ? 5 : 3.5} className="chart-dot" /><text x={point.x} y={height - 10} textAnchor="middle" className="chart-x-label">{point.label}</text></g>)}
      </svg>
    </div>
  );
}

function DonutChart() {
  const circumference = 2 * Math.PI * 42;
  let offset = 0;
  return (
    <div className="segment-visual">
      <div className="donut-container">
        <svg viewBox="0 0 120 120" className="donut" aria-label="Distribuição de inscrições por modalidade" role="img">
          <circle cx="60" cy="60" r="42" className="donut-base" />
          {registrationSegments.map((segment) => {
            const length = (segment.value / 100) * circumference;
            const circle = <circle key={segment.label} cx="60" cy="60" r="42" className="donut-segment" stroke={segment.color} strokeDasharray={`${length - 3} ${circumference - length + 3}`} strokeDashoffset={-offset} />;
            offset += length;
            return circle;
          })}
        </svg>
        <div className="donut-center"><strong>496</strong><span>inscrições</span></div>
      </div>
      <div className="segment-legend">{registrationSegments.map((segment) => <div key={segment.label}><span style={{ background: segment.color }} /><span>{segment.label}</span><strong>{segment.value}%</strong></div>)}</div>
    </div>
  );
}

export function OverviewContent() {
  return (
    <>
      <section className="demo-notice"><span>i</span><p>Você está visualizando dados de demonstração. As informações serão substituídas após a primeira importação.</p></section>
      <section className="metric-grid" aria-label="Indicadores de inscrições">
        <MetricCard label="Total de inscrições" value="496" change="+18,1%" note="vs. período anterior" trend={[18, 22, 21, 30, 33, 42, 47, 55]} />
        <MetricCard label="Inscrições nos últimos 7 dias" value="154" change="+12,4%" note="vs. 7 dias anteriores" trend={[12, 14, 16, 15, 20, 22, 27, 31]} tone="purple" />
        <MetricCard label="Taxa de ocupação" value="49,6%" change="+5,8 p.p." note="da meta de 1.000" trend={[16, 19, 22, 27, 32, 35, 40, 46]} tone="teal" />
        <MetricCard label="Média diária" value="16,5" change="+8,7%" note="inscrições por dia" trend={[10, 13, 12, 15, 16, 17, 19, 21]} />
      </section>
      <section className="content-grid content-grid-primary">
        <article className="panel trend-panel">
          <div className="panel-heading"><div><h2>Evolução das inscrições</h2><p>Volume acumulado no período</p></div><button className="text-button" type="button">Ver detalhes <span>→</span></button></div>
          <div className="chart-summary"><strong>496</strong><span><b>↑ 18,1%</b> desde o início do período</span></div>
          <RegistrationChart />
        </article>
        <article className="panel distribution-panel">
          <div className="panel-heading"><div><h2>Por modalidade</h2><p>Distribuição das inscrições</p></div><button className="more-button" type="button" aria-label="Mais opções">•••</button></div>
          <DonutChart />
          <div className="panel-divider" />
          <div className="goal-summary"><span>Meta do evento</span><strong>1.000 participantes</strong><div className="progress-track"><span /></div><small>496 inscrições confirmadas</small></div>
        </article>
      </section>
      <section className="content-grid content-grid-secondary">
        <article className="panel registrations-panel">
          <div className="panel-heading"><div><h2>Inscrições recentes</h2><p>Últimas confirmações recebidas</p></div><button className="text-button" type="button">Ver todas <span>→</span></button></div>
          <div className="recent-list">{recentRegistrations.map((registration) => <div className="recent-row" key={registration.name}><span className="person-avatar" style={{ backgroundColor: registration.color }}>{registration.initials}</span><div className="recent-person"><strong>{registration.name}</strong><span>{registration.city}</span></div><span className="modality-tag">{registration.modality}</span><time>{registration.time}</time></div>)}</div>
        </article>
        <article className="panel insight-panel">
          <div className="panel-heading"><div><h2>Insights da semana</h2><p>Resumo dos dados demonstrativos</p></div><span className="sparkle">✦</span></div>
          <div className="insight-content"><div className="insight-icon">↗</div><div><strong>O ritmo de inscrições acelerou</strong><p>O volume dos últimos 7 dias está 12,4% acima da semana anterior, com maior procura pela modalidade de 5 km.</p><button type="button">Explorar análise <span>→</span></button></div></div>
          <div className="insight-footer"><span>Próxima leitura sugerida</span><strong>Desempenho por canal de divulgação <span>→</span></strong></div>
        </article>
      </section>
    </>
  );
}

export function PageIntro({ eyebrow, title, children }: { eyebrow: string; title: string; children: ReactNode }) {
  return <section className="module-intro"><span>{eyebrow}</span><h2>{title}</h2><p>{children}</p></section>;
}

export function RegistrationContent() {
  return <>
    <section className="metric-grid"><MetricCard label="Inscrições confirmadas" value="496" change="+18,1%" note="vs. período anterior" trend={[18, 22, 21, 30, 33, 42, 47, 55]} /><MetricCard label="Novas hoje" value="23" change="+4,5%" note="em relação à média" trend={[11, 12, 10, 14, 16, 18, 19, 23]} tone="purple" /><MetricCard label="Pendentes" value="12" change="−2" note="desde ontem" trend={[23, 21, 22, 18, 17, 15, 14, 12]} tone="teal" /></section>
    <section className="content-grid content-grid-primary"><article className="panel trend-panel"><div className="panel-heading"><div><h2>Ritmo de inscrições</h2><p>Acumulado de inscrições confirmadas</p></div><button className="text-button" type="button">Exportar dados</button></div><RegistrationChart /></article><article className="panel"><div className="panel-heading"><div><h2>Modalidades</h2><p>Preferência dos participantes</p></div></div><DonutChart /></article></section>
    <article className="panel table-panel"><div className="panel-heading"><div><h2>Participantes recentes</h2><p>Dados demonstrativos para validação da interface</p></div><button className="outline-button" type="button">Filtrar</button></div><div className="table-scroll"><table><thead><tr><th>Participante</th><th>Modalidade</th><th>Localidade</th><th>Status</th><th>Inscrição</th></tr></thead><tbody>{recentRegistrations.map((row, index) => <tr key={row.name}><td><div className="table-person"><span className="person-avatar" style={{ backgroundColor: row.color }}>{row.initials}</span>{row.name}</div></td><td>{row.modality}</td><td>{row.city}</td><td><span className="status-badge">Confirmada</span></td><td>{index + 24} jun 2026</td></tr>)}</tbody></table></div></article>
  </>;
}

export function OutreachContent() {
  return <>
    <section className="metric-grid"><MetricCard label="Alcance no Instagram" value="39,7 mil" change="+22,8%" note="vs. período anterior" trend={[11, 14, 19, 18, 26, 29, 35, 39]} /><MetricCard label="Taxa de engajamento" value="6,4%" change="+0,9 p.p." note="em relação à média" trend={[3, 4, 4, 5, 5, 6, 6, 7]} tone="purple" /><MetricCard label="Publicações no período" value="24" change="+6" note="em relação ao anterior" trend={[2, 3, 4, 5, 8, 12, 18, 24]} tone="teal" /></section>
    <section className="content-grid content-grid-primary"><article className="panel trend-panel"><div className="panel-heading"><div><h2>Alcance e inscrições</h2><p>Leitura conjunta por período</p></div><button className="text-button" type="button">Ver relatório <span>→</span></button></div><div className="comparison-legend"><span><i className="legend-dot blue" /> Inscrições</span><span><i className="legend-dot purple" /> Alcance no Instagram</span></div><RegistrationChart /></article><article className="panel"><div className="panel-heading"><div><h2>Leitura do período</h2><p>Sinal para acompanhamento</p></div><span className="sparkle">✦</span></div><div className="callout"><span className="callout-icon">↗</span><strong>Maior procura após conteúdos em vídeo</strong><p>Esta é uma associação temporal entre os dados demonstrativos; ainda não representa atribuição comprovada.</p></div></article></section>
    <article className="panel table-panel"><div className="panel-heading"><div><h2>Conteúdos em destaque</h2><p>Publicações com dados demonstrativos</p></div><button className="outline-button" type="button">Adicionar métricas</button></div><div className="table-scroll"><table><thead><tr><th>Conteúdo</th><th>Formato</th><th>Alcance</th><th>Engajamento</th><th>Variação de inscrições</th></tr></thead><tbody>{campaigns.map((campaign) => <tr key={campaign.name}><td><strong>{campaign.name}</strong></td><td>{campaign.format}</td><td>{campaign.reach}</td><td>{campaign.engagement}</td><td><span className="positive-text">{campaign.registrations}</span></td></tr>)}</tbody></table></div></article>
  </>;
}

export function ReportsContent() {
  const reports = [
    ["Resumo do evento", "Indicadores gerais e evolução das inscrições", "Atualizado agora"],
    ["Desempenho de divulgação", "Alcance, interações e variação no período", "Atualizado agora"],
    ["Perfil de participantes", "Distribuição por modalidade e localidade", "Dados demonstrativos"],
  ];
  return <section className="report-grid">{reports.map(([name, description, status]) => <article className="report-card" key={name}><div className="report-icon">▤</div><span>{status}</span><h2>{name}</h2><p>{description}</p><button type="button">Abrir relatório <span>→</span></button></article>)}</section>;
}

export function ImportsContent() {
  return <><article className="upload-card"><div className="upload-symbol">↑</div><div><h2>Adicionar dados</h2><p>Envie uma planilha CSV ou XLSX com inscrições ou métricas de divulgação.</p></div><button className="primary-button" type="button">Selecionar arquivo</button></article><article className="panel table-panel"><div className="panel-heading"><div><h2>Histórico de importações</h2><p>Registros demonstrativos de processamento</p></div></div><div className="table-scroll"><table><thead><tr><th>Arquivo</th><th>Enviado em</th><th>Registros</th><th>Status</th></tr></thead><tbody>{importHistory.map((item) => <tr key={item.date}><td><strong>{item.file}</strong></td><td>{item.date}</td><td>{item.count}</td><td><span className="status-badge">{item.status}</span></td></tr>)}</tbody></table></div></article></>;
}
