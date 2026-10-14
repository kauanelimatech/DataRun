import { DashboardShell } from "@/components/dashboard-shell";

const connections = [
  ["Instagram Insights", "Métricas de alcance e engajamento", "Conectado", "Atualizado há 4 min"],
  ["Base de inscrições", "Arquivos CSV e XLSX exportados", "Pronto para importar", "Nenhum arquivo pendente"],
  ["Algoritmo de atribuição", "Janela de correlação de até 24 horas", "Ativo", "Pearson r e atribuição ponderada"],
];

export default function SettingsPage() {
  return <DashboardShell title="Configurações" description="Conexões, fontes de dados e regras do painel">
    <section className="settings-panel">
      <div><h2>Fontes e regras de análise</h2><p>Os dados exibidos nesta etapa são demonstrativos e não representam integrações ativas.</p></div>
      {connections.map(([name, description, state, detail]) => <article key={name}><div><span>{name}</span><p>{description}</p></div><div><b>{state}</b><small>{detail}</small></div><button type="button">Configurar</button></article>)}
    </section>
  </DashboardShell>;
}
