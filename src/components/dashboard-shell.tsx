"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ReactNode, useState } from "react";
import { SocialConnectionStatus } from "@/components/social-connection-status";

type DashboardShellProps = {
  title: string;
  description: string;
  children: ReactNode;
  socialConnectionStatus?: "connected" | "error" | "waiting";
};

const navItems = [
  { href: "/", label: "Visão Geral & Correlação", icon: "grid" },
  { href: "/eventos", label: "Eventos & Lotes", icon: "ticket" },
  { href: "/divulgacao", label: "Posts do Instagram", icon: "megaphone" },
  { href: "/importacoes", label: "Importações", icon: "upload" },
  { href: "/relatorios", label: "Relatórios", icon: "chart" },
  { href: "/configuracoes", label: "Configurações", icon: "settings" },
];

function Icon({ name, size = 18 }: { name: string; size?: number }) {
  const paths: Record<string, ReactNode> = {
    grid: <><rect x="3" y="3" width="7" height="7" rx="1" /><rect x="14" y="3" width="7" height="7" rx="1" /><rect x="3" y="14" width="7" height="7" rx="1" /><rect x="14" y="14" width="7" height="7" rx="1" /></>,
    run: <><circle cx="15" cy="5" r="2" /><path d="m6 21 3-6 3 2 2 4" /><path d="m9 15 2-5 3 2 3 1" /><path d="m7 9 4 1" /></>,
    megaphone: <><path d="m4 14 1.5 5h3L8 14" /><path d="m5 8 12-4v12L5 12Z" /><path d="M19 9h2" /></>,
    chart: <><path d="M4 19V5" /><path d="M4 19h17" /><path d="m7 15 4-4 3 2 5-6" /></>,
    ticket: <><path d="M4 5h16v5a2 2 0 0 0 0 4v5H4v-5a2 2 0 0 0 0-4Z" /><path d="M13 5v14" /></>,
    upload: <><path d="M12 16V3" /><path d="m7 8 5-5 5 5" /><path d="M5 14v6h14v-6" /></>,
    calendar: <><rect x="3" y="5" width="18" height="16" rx="2" /><path d="M16 3v4M8 3v4M3 10h18" /></>,
    settings: <><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.6 1.6 0 0 0 .32 1.77l.06.06-2.12 2.12-.06-.06a1.6 1.6 0 0 0-1.77-.32 1.6 1.6 0 0 0-.97 1.46V20h-3v-.08a1.6 1.6 0 0 0-.97-1.46 1.6 1.6 0 0 0-1.77.32l-.06.06-2.12-2.12.06-.06A1.6 1.6 0 0 0 7.32 15a1.6 1.6 0 0 0-1.46-.97H5.8v-3h.08a1.6 1.6 0 0 0 1.46-.97 1.6 1.6 0 0 0-.32-1.77l-.06-.06 2.12-2.12.06.06a1.6 1.6 0 0 0 1.77.32h.02a1.6 1.6 0 0 0 .95-1.46V5h3v.08a1.6 1.6 0 0 0 .97 1.46 1.6 1.6 0 0 0 1.77-.32l.06-.06 2.12 2.12-.06.06a1.6 1.6 0 0 0-.32 1.77v.02a1.6 1.6 0 0 0 1.46.95H20v3h-.08A1.6 1.6 0 0 0 19.4 15Z" /></>,
    menu: <><path d="M4 7h16M4 12h16M4 17h16" /></>,
    bell: <><path d="M18 9a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9" /><path d="M10 21h4" /></>,
    chevron: <path d="m9 18 6-6-6-6" />,
    close: <><path d="m6 6 12 12M18 6 6 18" /></>,
  };

  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{paths[name]}</svg>;
}

function Navigation({ items, pathname, onNavigate }: { items: typeof navItems; pathname: string; onNavigate: () => void }) {
  return (
    <nav className="sidebar-nav">
      {items.map((item) => {
        const isActive = item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
        return (
          <Link className={`nav-link ${isActive ? "active" : ""}`} href={item.href} key={item.href} onClick={onNavigate}>
            <Icon name={item.icon} />
            <span>{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}

export function DashboardShell({ title, description, children, socialConnectionStatus }: DashboardShellProps) {
  const pathname = usePathname();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [selectedScope, setSelectedScope] = useState("Todos os eventos");
  const [selectedPeriod, setSelectedPeriod] = useState("Todo o período");
  const [selectedRange, setSelectedRange] = useState("Todo o período");
  const [isScopeOpen, setIsScopeOpen] = useState(false);
  const [isPeriodOpen, setIsPeriodOpen] = useState(false);
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);

  const closeMenu = () => setIsMenuOpen(false);

  return (
    <div className="app-shell">
      {isMenuOpen && <button className="sidebar-overlay" type="button" aria-label="Fechar menu" onClick={closeMenu} />}
      <aside className={`sidebar ${isMenuOpen ? "is-open" : ""}`}>
        <div className="brand-row">
          <Link href="/" className="brand" onClick={closeMenu} aria-label="DataRun - Página inicial">
            <span className="brand-mark"><span /><span /><span /></span>
            <span><b>DataRun</b><small>EVENT ANALYTICS</small></span>
          </Link>
          <button className="sidebar-close" onClick={closeMenu} type="button" aria-label="Fechar menu"><Icon name="close" /></button>
        </div>

        <div className="nav-group">
          <p className="nav-group-label">Navegação</p>
          <Navigation items={navItems} pathname={pathname} onNavigate={closeMenu} />
        </div>

        <div className="sidebar-footer">
          <div className="system-card">
            <div className="system-title"><span>Sistema</span><i /></div>
            <div><span>Base de inscrições</span><b>Conectada</b></div>
            <div><span>Dados sociais</span><SocialConnectionStatus initialStatus={socialConnectionStatus} /></div>
          </div>
        </div>
      </aside>

      <div className="workspace">
        <header className="topbar">
          <button className="menu-button" type="button" onClick={() => setIsMenuOpen(true)} aria-label="Abrir menu"><Icon name="menu" /></button>
          <div className="header-filters">
            <div className="filter-menu">
              <button className="header-select" type="button" onClick={() => { setIsScopeOpen(!isScopeOpen); setIsPeriodOpen(false); }}><Icon name="calendar" size={15} /><span>{selectedScope}</span><b>⌄</b></button>
              {isScopeOpen && <div className="filter-popover">{["Todos os eventos"].map((scope) => <button type="button" key={scope} onClick={() => { setSelectedScope(scope); setIsScopeOpen(false); }}>{scope}</button>)}</div>}
            </div>
            <div className="filter-menu period-menu">
              <button className="header-select" type="button" onClick={() => { setIsPeriodOpen(!isPeriodOpen); setIsScopeOpen(false); }}><Icon name="calendar" size={15} /><span>{selectedPeriod}</span><b>⌄</b></button>
              {isPeriodOpen && <div className="filter-popover">{["Todo o período"].map((period) => <button type="button" key={period} onClick={() => { setSelectedPeriod(period); setIsPeriodOpen(false); }}>{period}</button>)}</div>}
            </div>
          </div>
          <div className="topbar-actions">
            <Link className="header-import" href="/importacoes"><Icon name="upload" size={15} /> Importar dados</Link>
            <div className="notification-wrap"><button className="notification-button" type="button" aria-label="Notificações" onClick={() => setIsNotificationsOpen(!isNotificationsOpen)}><Icon name="bell" /><span /></button>{isNotificationsOpen && <div className="notification-popover"><strong>Atualizações</strong><p>Os indicadores são atualizados após cada importação concluída.</p></div>}</div>
            <div className="profile-summary"><span><strong>Área restrita</strong><small>DataRun</small></span><span className="avatar">DR</span></div>
          </div>
        </header>
        <main className="main-content">
          <div className="page-heading">
            <div><p className="page-eyebrow">Painel administrativo <i /> {description}</p><h1>{title}</h1></div>
            <div className="range-tabs">{["Todo o período"].map((range) => <button className={selectedRange === range ? "active" : ""} type="button" key={range} onClick={() => setSelectedRange(range)}><Icon name="calendar" size={14} />{range}</button>)}</div>
          </div>
          {children}
        </main>
      </div>
    </div>
  );
}
