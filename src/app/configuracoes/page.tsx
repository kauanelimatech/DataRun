import { DashboardShell } from "@/components/dashboard-shell";
import { requireAdministrator } from "@/lib/auth/access";
import { getDashboardData } from "@/lib/dashboard-data";

export default async function SettingsPage() {
  const access = await requireAdministrator();
  const { imports } = await getDashboardData();
  const latestImport = imports[0];
  const connections = [
    ["Base de inscrições", "Planilhas de inscrições processadas pelo importador.", latestImport ? "Conectada" : "Aguardando importação", latestImport ? latestImport.fileName : "Nenhum arquivo concluído"],
    ["Dados pessoais", "O importador permite apenas campos analíticos e faixas etárias derivadas.", "Protegido", "Identificadores diretos são descartados"],
    ["Instagram Insights", "Métricas de alcance e engajamento para análise de conversão.", "Aguardando", "Fonte ainda não importada"],
  ];
  return <DashboardShell title="Configurações" description="Status das fontes e regras de proteção dos dados." role={access.role}><section className="settings-panel"><div><h2>Fontes e regras de análise</h2><p>O painel exibe o estado atual das fontes conectadas.</p></div>{connections.map(([name, description, state, detail]) => <article key={name}><div><span>{name}</span><p>{description}</p></div><div><b>{state}</b><small>{detail}</small></div></article>)}</section></DashboardShell>;
}
