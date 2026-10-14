"use client";

import { ChangeEvent, useRef, useState } from "react";

const eventFilters = ["Todos os Eventos (4 ativos)", "Meia Maratona Sunset SP", "Circuito Trail Series 21k", "Desafio Noturno das Pontes", "Gran Fondo de Ciclismo"];

const timelineBars = [
  270, 305, 250, 230, 330, 455, 375, 210, 270, 350, 565, 905, 720, 410, 260, 305, 280, 305, 440, 495, 410, 710, 600, 455, 330, 270, 410, 540, 460,
];

const posts = [
  { title: "Últimas 50 vagas Lote 1", format: "Reel", date: "12 Out, 18:30", event: "Meia Maratona Sunset SP", social: "48.2k views · 2.4k likes · 384 com.", registrations: "890 insc.", change: "+340%", impact: "Alto", tone: "high" },
  { title: "Apresentação Kit Atleta & Medalha", format: "Carrossel", date: "22 Out, 12:15", event: "Circuito Trail Series 21k", social: "31.4k alcance · 3.1k likes · 490 com.", registrations: "640 insc.", change: "+180%", impact: "Alto", tone: "high" },
  { title: "Teaser Oficial: Percurso Noturno", format: "Reel", date: "06 Out, 20:00", event: "Desafio Noturno das Pontes", social: "24.8k views · 1.9k likes · 140 com.", registrations: "390 insc.", change: "+95%", impact: "Médio", tone: "medium" },
  { title: "Altimetria e Dicas de Marcha", format: "Estático", date: "17 Out, 09:40", event: "Gran Fondo de Ciclismo", social: "9.6k alcance · 820 likes · 45 com.", registrations: "115 insc.", change: "+12%", impact: "Baixo", tone: "low" },
];

type HighlightedPost = { day: string; title: string; reach: string; registrations: string; increase: string; left: string; top: string };

const highlightedPosts: HighlightedPost[] = [
  { day: "12 OUT", title: "REEL VIRADA LOTE", reach: "48.2k views", registrations: "890 inscrições (24h)", increase: "+340%", left: "39%", top: "4%" },
  { day: "22 OUT", title: "KIT DO ATLETA", reach: "31.4k alcance", registrations: "640 inscrições", increase: "+180%", left: "72%", top: "15%" },
];

function MiniGlyph({ type }: { type: "chart" | "upload" | "post" | "file" | "spark" }) {
  const symbols = { chart: "↗", upload: "↥", post: "▣", file: "▤", spark: "⌁" };
  return <span className={`analytics-glyph ${type}`}>{symbols[type]}</span>;
}

function CorrelationChart() {
  const [activePost, setActivePost] = useState(0);
  const selected = highlightedPosts[activePost];
  const linePoints = "2,75 8,71 14,65 20,55 26,60 32,57 38,36 42,7 47,49 52,68 58,65 64,55 70,46 75,18 80,45 85,58 90,62 95,50 99,60";

  return (
    <section className="correlation-panel">
      <div className="correlation-header"><div><h2><MiniGlyph type="chart" /> Linha do Tempo: Inscrições Diárias vs. Publicações do Instagram</h2><p>Sobreposição de dados: barras representam inscrições e a linha mostra as impressões/alcance das postagens.</p></div></div>
      <div className="chart-legend"><span><i className="bar-key" /> Inscrições no Dia (Unid)</span><span><i className="line-key" /> Alcance & Engajamento IG</span><span><i className="post-key" /> Ponto de Post</span></div>
      <div className="correlation-plot">
        <div className="axis-label axis-left one">1.000 insc.</div><div className="axis-label axis-left two">750 insc.</div><div className="axis-label axis-left three">500 insc.</div><div className="axis-label axis-left four">250 insc.</div>
        <div className="axis-label axis-right one">60k alcance</div><div className="axis-label axis-right three">45k alcance</div><div className="axis-label axis-right four">30k alcance</div><div className="axis-label axis-right five">15k alcance</div>
        <div className="plot-gridline grid-one" /><div className="plot-gridline grid-two" /><div className="plot-gridline grid-three" /><div className="plot-gridline grid-four" />
        <div className="bar-series">{timelineBars.map((height, index) => <span className={index === 5 || index === 11 || index === 21 || index === 27 ? "event-bar" : ""} style={{ height: `${height / 10}%` }} key={index} />)}</div>
        <svg className="correlation-line" viewBox="0 0 100 100" preserveAspectRatio="none" aria-label="Variação de alcance no Instagram"><polyline points={linePoints} /></svg>
        {highlightedPosts.map((post, index) => <button className={`post-marker marker-${index}`} style={{ left: post.left, top: index === 0 ? "12%" : "27%" }} type="button" aria-label={`Ver detalhes de ${post.title}`} onClick={() => setActivePost(index)} key={post.title}><i /></button>)}
        <div className="chart-tooltip" style={{ left: selected.left, top: selected.top }}><span><b>{selected.day}</b> · {selected.title} <em>{selected.increase}</em></span><p>{selected.reach} → <strong>{selected.registrations}</strong></p></div>
        <div className="timeline-dates"><span>01 Out</span><span>05 Out</span><b>12 Out (Lote 1)</b><span>18 Out</span><b>22 Out (Percurso)</b><span>26 Out</span><b>30 Out (Lote 2)</b></div>
      </div>
      <div className="conversion-insight"><span className="idea-mark">◉</span><div><strong>Insight analítico de conversão</strong><p>Vídeos curtos (<b>Reels</b>) com aviso de virada de lote e sticker de link direto possuem taxa de conversão em inscrições <b>3,4x maior</b> do que posts estáticos. O intervalo de maior velocidade ocorre entre as <b>3 e 14 horas</b> subsequentes à publicação.</p></div></div>
    </section>
  );
}

function ImpactTable() {
  return <section className="impact-table-panel"><div className="section-top"><div><h2>Publicações com Maior Impacto em Vendas</h2><p>Classificação por atribuição direta e volume de tickets emitidos em 24h</p></div><button type="button">Ver todos os 64 posts <span>→</span></button></div><div className="impact-scroll"><table className="impact-table"><thead><tr><th>Post / formato</th><th>Data</th><th>Evento alvo</th><th>Métricas sociais</th><th>Insc. 24h</th><th>Variação</th><th>Impacto</th></tr></thead><tbody>{posts.map((post, index) => <tr key={post.title}><td><div className="post-cell"><span className={`post-thumbnail thumbnail-${index + 1}`}>▧</span><span><strong>{post.title}</strong><small>{post.format}</small></span></div></td><td>{post.date}</td><td>{post.event}</td><td>{post.social}</td><td><b>{post.registrations}</b></td><td className="positive-cell">{post.change}</td><td><span className={`impact-tag ${post.tone}`}>{post.impact}</span></td></tr>)}</tbody></table></div></section>;
}

function DataMemory() {
  const [fileName, setFileName] = useState<string | null>(null);
  const input = useRef<HTMLInputElement>(null);
  const pickFile = (event: ChangeEvent<HTMLInputElement>) => setFileName(event.target.files?.[0]?.name ?? null);
  return <aside className="memory-panel"><div className="section-top"><div><h2><MiniGlyph type="file" /> Bases CSV em Memória</h2></div><span className="active-count">2 ativas</span></div><div className="memory-file"><div><b>inscricoes_lotes_outubro.csv</b><i>✓</i></div><p><strong>14.280 linhas</strong> processadas <span>2.4 MB</span></p><div className="load-progress"><span /></div></div><div className="memory-file blue"><div><b>instagram_metrics_export.csv</b><i>✓</i></div><p><strong>64 publicações mapeadas</strong> <span>840 KB</span></p><div className="load-progress"><span /></div></div>{fileName ? <div className="new-file-notice"><b>Arquivo selecionado</b><span>{fileName}</span></div> : <button type="button" className="upload-dropzone" onClick={() => input.current?.click()}><MiniGlyph type="upload" /><strong>Arrastar novo CSV para atualizar</strong><span>Compatível com relatórios Sympla, Ticket Sports, Ativo e Instagram Graph</span><em>Selecionar Arquivo</em></button>}<input ref={input} className="visually-hidden" type="file" accept=".csv,.xlsx" onChange={pickFile} /><div className="mapping-list"><p>Mapeamento automático</p><span>timestamp → data_venda</span><span>ig_reach → alcance_social</span><span>ticket_val → receita</span></div></aside>;
}

export function AnalyticsOverview() {
  const [activeEvent, setActiveEvent] = useState(eventFilters[0]);
  return <>
    <div className="event-filter-row">{eventFilters.map((event) => <button className={event === activeEvent ? "active" : ""} type="button" onClick={() => setActiveEvent(event)} key={event}>{event}</button>)}</div>
    <section className="sync-banner"><span>▣</span><strong>Sincronizado</strong><p>Base: <b>inscricoes_eventos_v2.csv</b> (14.280 registros) + <b>instagram_insights_out.csv</b> (64 posts mapeados)</p><time>Att: há 4 minutos</time><button type="button" onClick={() => document.getElementById("analytics-upload")?.click()}><MiniGlyph type="upload" /> Importar novo CSV</button><input id="analytics-upload" className="visually-hidden" type="file" accept=".csv,.xlsx" /></section>
    <section className="analytics-metrics">
      <article><span>Total de inscrições</span><div><strong>14.280</strong><i className="up-pill">↑ +22,4%</i></div><div className="metric-detail">vs. 11.660 no mês ant. <b>+3.180 por picos sociais</b><svg viewBox="0 0 85 40"><path d="M2 30 C18 27 20 37 33 27 S51 5 62 13 S73 33 82 5" /></svg></div></article>
      <article className="correlation-metric"><span>Correlação Instagram</span><div><strong>+0,82</strong><i className="pearson-pill">Pearson r = +0.82</i></div><p><b>Forte associação linear</b><span className="correlation-progress"><i /></span><em>0.82 / 1.0</em></p><small>ϟ Vendas convertem em até 24h pós-post</small></article>
      <article><span>Engajamento Instagram</span><div><strong className="blue-number">184.5k</strong><i className="posts-pill">64 posts</i></div><div className="metric-detail"><span>◉ 117k Reels</span><b>62.3k likes • 4.8k comentários • 12.1k clicks</b></div></article>
      <article><span>Receita acumulada</span><div><strong>R$ 1.642.200</strong><i className="ticket-pill">Ticket R$ 115</i></div><div className="metric-detail"><span>Meta lote: 88,5% concluída</span><b>ROI Social: 14.8x</b></div></article>
    </section>
    <CorrelationChart />
    <section className="analytics-bottom"><ImpactTable /><DataMemory /></section>
  </>;
}
