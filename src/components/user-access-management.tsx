"use client";

import { FormEvent, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

type DashboardRole = "ADMINISTRATOR" | "ORGANIZER";

type ManagedDashboardUser = {
  id: string;
  email: string;
  role: DashboardRole;
  mustSetPassword: boolean;
  invitedAt: string | null;
  passwordResetAt: string | null;
  passwordSetAt: string | null;
  accessLinkCreatedAt: string | null;
  createdAt: string;
};

type LinkResult = {
  email: string;
  url: string;
  reason: "invite" | "reset";
};

function formatDate(value: string | null) {
  if (!value) return "Ainda não";
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

function roleLabel(role: DashboardRole) {
  return role === "ADMINISTRATOR" ? "Administrador" : "Organizador";
}

export function UserAccessManagement({ users }: { users: ManagedDashboardUser[] }) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<DashboardRole>("ORGANIZER");
  const [isCreating, setIsCreating] = useState(false);
  const [resettingId, setResettingId] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [linkResult, setLinkResult] = useState<LinkResult | null>(null);

  const awaitingPasswordCount = useMemo(() => users.filter((user) => user.mustSetPassword).length, [users]);

  async function readResponse(response: Response) {
    return response.json().catch(() => null) as Promise<{ error?: string; accessLink?: string; email?: string; user?: { email?: string } } | null>;
  }

  async function createAccess(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsCreating(true);
    setError(null);
    setMessage(null);
    setLinkResult(null);

    try {
      const response = await fetch("/api/admin/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, role }),
      });
      const payload = await readResponse(response);
      if (!response.ok || !payload?.accessLink) throw new Error(payload?.error || "Não foi possível criar o acesso.");

      setLinkResult({
        email: payload.user?.email || email.trim().toLowerCase(),
        url: payload.accessLink,
        reason: "invite",
      });
      setMessage("A conta foi preparada. Copie o link abaixo e entregue-o ao titular pelo canal de sua preferência.");
      setEmail("");
      setRole("ORGANIZER");
      router.refresh();
    } catch (createError) {
      setError(createError instanceof Error ? createError.message : "Não foi possível criar o acesso.");
    } finally {
      setIsCreating(false);
    }
  }

  async function resetPassword(user: ManagedDashboardUser) {
    const confirmation = window.confirm(`Gerar um novo link de senha para ${user.email}? A senha atual deixará de permitir novos acessos.`);
    if (!confirmation) return;

    setResettingId(user.id);
    setError(null);
    setMessage(null);
    setLinkResult(null);

    try {
      const response = await fetch(`/api/admin/users/${user.id}/reset-password`, { method: "POST" });
      const payload = await readResponse(response);
      if (!response.ok || !payload?.accessLink) throw new Error(payload?.error || "Não foi possível gerar um novo link.");

      setLinkResult({
        email: payload.email || user.email,
        url: payload.accessLink,
        reason: "reset",
      });
      setMessage("A redefinição foi iniciada. Copie o novo link abaixo; ele substitui o acesso por senha anterior.");
      router.refresh();
    } catch (resetError) {
      setError(resetError instanceof Error ? resetError.message : "Não foi possível gerar um novo link.");
    } finally {
      setResettingId(null);
    }
  }

  async function copyAccessLink() {
    if (!linkResult) return;
    try {
      await navigator.clipboard.writeText(linkResult.url);
      setMessage("Link copiado. Compartilhe-o apenas com o titular da conta.");
    } catch {
      setError("Não foi possível copiar automaticamente. Selecione e copie o link manualmente.");
    }
  }

  return <div className="access-management">
    <section className="access-intro">
      <div>
        <p className="section-kicker">Controle de acesso</p>
        <h2>Contas autorizadas para o DataRun</h2>
        <p>Administradores editam fontes, eventos e classificações. Organizadores visualizam os indicadores, sem alterar dados.</p>
      </div>
      <div className="access-intro-count"><strong>{users.length}</strong><span>conta(s)</span><small>{awaitingPasswordCount} aguardando senha</small></div>
    </section>

    <section className="access-grid">
      <article className="access-create-card">
        <p className="section-kicker">Novo acesso</p>
        <h2>Gerar link de ativação</h2>
        <p>Não há envio automático de e-mail. O link aparecerá uma única vez para cópia e compartilhamento manual.</p>
        <form onSubmit={createAccess}>
          <label>E-mail do usuário<input type="email" value={email} autoComplete="email" onChange={(event) => setEmail(event.target.value)} placeholder="organizador@empresa.com" required /></label>
          <label>Nível de acesso<select value={role} onChange={(event) => setRole(event.target.value as DashboardRole)}><option value="ORGANIZER">Organizador — somente visualização</option><option value="ADMINISTRATOR">Administrador — edição total</option></select></label>
          <button className="primary-button" type="submit" disabled={isCreating}>{isCreating ? "Gerando…" : "Gerar link de ativação"}</button>
        </form>
      </article>

      <article className="access-guidance-card">
        <p className="section-kicker">Como funciona</p>
        <ol>
          <li>Cadastre o e-mail e o nível de acesso.</li>
          <li>Copie o link exibido e envie-o pelo canal escolhido.</li>
          <li>O titular abre o link e define a própria senha.</li>
          <li>Após um reset, gere e compartilhe um novo link.</li>
        </ol>
        <p>Os links são sensíveis: não os registre em planilhas, conversas públicas ou documentos compartilhados.</p>
      </article>
    </section>

    {(message || error || linkResult) && <section className={`access-result ${error ? "error" : ""}`} role={error ? "alert" : "status"}>
      {message && <p>{message}</p>}
      {error && <p>{error}</p>}
      {linkResult && <div className="access-link-output"><div><strong>{linkResult.reason === "invite" ? "Link de ativação" : "Link de redefinição"}</strong><span>{linkResult.email}</span></div><input aria-label="Link de acesso gerado" value={linkResult.url} readOnly onFocus={(event) => event.currentTarget.select()} /><button className="outline-button" type="button" onClick={copyAccessLink}>Copiar link</button></div>}
    </section>}

    <section className="access-list-panel">
      <div className="access-list-heading"><div><p className="section-kicker">Acessos atuais</p><h2>Usuários cadastrados</h2></div><p>Use “Redefinir senha” para invalidar a senha atual e gerar um novo link manual.</p></div>
      <div className="access-list">
        {users.map((user) => <article className="access-user-row" key={user.id}>
          <div className="access-user-identity"><span className="access-avatar">{user.email.slice(0, 1).toUpperCase()}</span><div><strong>{user.email}</strong><small>Cadastrado em {formatDate(user.createdAt)}</small></div></div>
          <span className={`role-badge ${user.role.toLowerCase()}`}>{roleLabel(user.role)}</span>
          <div className="access-user-status"><strong className={user.mustSetPassword ? "awaiting" : "ready"}>{user.mustSetPassword ? "Aguardando senha" : "Ativo"}</strong><small>{user.mustSetPassword ? `Link gerado: ${formatDate(user.accessLinkCreatedAt)}` : `Senha definida: ${formatDate(user.passwordSetAt)}`}</small></div>
          <button className="outline-button" type="button" onClick={() => resetPassword(user)} disabled={resettingId === user.id}>{resettingId === user.id ? "Gerando…" : "Redefinir senha"}</button>
        </article>)}
      </div>
    </section>
  </div>;
}
