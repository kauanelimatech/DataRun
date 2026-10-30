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
  activationCodeCreatedAt: string | null;
  activationCodeExpiresAt: string | null;
  createdAt: string;
};

type ActivationCodeResult = {
  email: string;
  code: string;
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

export function UserAccessManagement({ users, currentUserId }: { users: ManagedDashboardUser[]; currentUserId: string }) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<DashboardRole>("ORGANIZER");
  const [isCreating, setIsCreating] = useState(false);
  const [resettingId, setResettingId] = useState<string | null>(null);
  const [updatingRoleId, setUpdatingRoleId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [roleEdits, setRoleEdits] = useState<Record<string, DashboardRole>>({});
  const [deleteTarget, setDeleteTarget] = useState<ManagedDashboardUser | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [activationCodeResult, setActivationCodeResult] = useState<ActivationCodeResult | null>(null);

  const awaitingPasswordCount = useMemo(() => users.filter((user) => user.mustSetPassword).length, [users]);

  async function readResponse(response: Response) {
    return response.json().catch(() => null) as Promise<{ error?: string; activationCode?: string; email?: string; user?: { email?: string } } | null>;
  }

  async function createAccess(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsCreating(true);
    setError(null);
    setMessage(null);
    setActivationCodeResult(null);

    try {
      const response = await fetch("/api/admin/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, role }),
      });
      const payload = await readResponse(response);
      if (!response.ok || !payload?.activationCode) throw new Error(payload?.error || "Não foi possível criar o acesso.");

      setActivationCodeResult({
        email: payload.user?.email || email.trim().toLowerCase(),
        code: payload.activationCode,
        reason: "invite",
      });
      setMessage("A conta foi preparada. Copie o código abaixo e entregue-o ao titular pelo canal de sua preferência.");
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
    const confirmation = window.confirm(`Gerar um novo código de senha para ${user.email}? A senha atual deixará de permitir novos acessos.`);
    if (!confirmation) return;

    setResettingId(user.id);
    setError(null);
    setMessage(null);
    setActivationCodeResult(null);

    try {
      const response = await fetch(`/api/admin/users/${user.id}/reset-password`, { method: "POST" });
      const payload = await readResponse(response);
      if (!response.ok || !payload?.activationCode) throw new Error(payload?.error || "Não foi possível gerar um novo código.");

      setActivationCodeResult({
        email: payload.email || user.email,
        code: payload.activationCode,
        reason: "reset",
      });
      setMessage("A redefinição foi iniciada. Copie o novo código abaixo; ele substitui o acesso por senha anterior.");
      router.refresh();
    } catch (resetError) {
      setError(resetError instanceof Error ? resetError.message : "Não foi possível gerar um novo código.");
    } finally {
      setResettingId(null);
    }
  }

  async function updateRole(user: ManagedDashboardUser) {
    const role = roleEdits[user.id] ?? user.role;
    if (role === user.role) return;

    setUpdatingRoleId(user.id);
    setError(null);
    setMessage(null);
    setActivationCodeResult(null);

    try {
      const response = await fetch(`/api/admin/users/${user.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role }),
      });
      const payload = await readResponse(response);
      if (!response.ok) throw new Error(payload?.error || "Não foi possível atualizar o nível de acesso.");

      setMessage(`${user.email} agora possui nível de ${roleLabel(role).toLowerCase()}.`);
      setRoleEdits((current) => {
        const { [user.id]: _unused, ...remaining } = current;
        return remaining;
      });
      router.refresh();
    } catch (updateError) {
      setError(updateError instanceof Error ? updateError.message : "Não foi possível atualizar o nível de acesso.");
    } finally {
      setUpdatingRoleId(null);
    }
  }

  async function deleteAccess() {
    if (!deleteTarget) return;

    setDeletingId(deleteTarget.id);
    setError(null);
    setMessage(null);
    setActivationCodeResult(null);

    try {
      const response = await fetch(`/api/admin/users/${deleteTarget.id}`, { method: "DELETE" });
      const payload = await readResponse(response);
      if (!response.ok) throw new Error(payload?.error || "Não foi possível excluir este acesso.");

      setMessage(`O acesso de ${deleteTarget.email} foi excluído e não poderá mais entrar no DataRun.`);
      setDeleteTarget(null);
      router.refresh();
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : "Não foi possível excluir este acesso.");
    } finally {
      setDeletingId(null);
    }
  }

  async function copyActivationCode() {
    if (!activationCodeResult) return;
    try {
      await navigator.clipboard.writeText(activationCodeResult.code);
      setMessage("Código copiado. Compartilhe-o apenas com o titular da conta.");
    } catch {
      setError("Não foi possível copiar automaticamente. Selecione e copie o código manualmente.");
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
        <h2>Gerar código de ativação</h2>
        <p>Não há envio automático de e-mail. O código aparecerá uma única vez para cópia e compartilhamento manual.</p>
        <form onSubmit={createAccess}>
          <label>E-mail do usuário<input type="email" value={email} autoComplete="email" onChange={(event) => setEmail(event.target.value)} placeholder="organizador@empresa.com" required /></label>
          <label>Nível de acesso<select value={role} onChange={(event) => setRole(event.target.value as DashboardRole)}><option value="ORGANIZER">Organizador — somente visualização</option><option value="ADMINISTRATOR">Administrador — edição total</option></select></label>
          <button className="primary-button" type="submit" disabled={isCreating}>{isCreating ? "Gerando…" : "Gerar código de ativação"}</button>
        </form>
      </article>

      <article className="access-guidance-card">
        <p className="section-kicker">Como funciona</p>
        <ol>
          <li>Cadastre o e-mail e o nível de acesso.</li>
          <li>Copie o código exibido e envie-o pelo canal escolhido.</li>
          <li>O titular informa e-mail, código e cria a própria senha.</li>
          <li>Após um reset, gere e compartilhe um novo código.</li>
        </ol>
      <p>Os códigos são sensíveis: não os registre em planilhas, conversas públicas ou documentos compartilhados.</p>
      </article>
    </section>

    {(message || error || activationCodeResult) && <section className={`access-result ${error ? "error" : ""}`} role={error ? "alert" : "status"}>
      {message && <p>{message}</p>}
      {error && <p>{error}</p>}
      {activationCodeResult && <div className="access-link-output"><div><strong>{activationCodeResult.reason === "invite" ? "Código de ativação" : "Código de redefinição"}</strong><span>{activationCodeResult.email}</span></div><input aria-label="Código de acesso gerado" value={activationCodeResult.code} readOnly onFocus={(event) => event.currentTarget.select()} /><button className="outline-button" type="button" onClick={copyActivationCode}>Copiar código</button></div>}
    </section>}

    <section className="access-list-panel">
      <div className="access-list-heading"><div><p className="section-kicker">Acessos atuais</p><h2>Usuários cadastrados</h2></div><p>Altere o nível, redefina a senha ou remova definitivamente um acesso.</p></div>
      <div className="access-list">
        {users.map((user) => {
          const isCurrentUser = user.id === currentUserId;
          const selectedRole = roleEdits[user.id] ?? user.role;
          const isUpdatingRole = updatingRoleId === user.id;
          const isDeleting = deletingId === user.id;

          return <article className="access-user-row" key={user.id}>
          <div className="access-user-identity"><span className="access-avatar">{user.email.slice(0, 1).toUpperCase()}</span><div><strong>{user.email}</strong><small>Cadastrado em {formatDate(user.createdAt)}</small></div></div>
          <div className="access-user-role"><span className={`role-badge ${user.role.toLowerCase()}`}>{roleLabel(user.role)}</span>{isCurrentUser ? <small>Conta atual</small> : <><label className="sr-only" htmlFor={`role-${user.id}`}>Nível de acesso de {user.email}</label><select id={`role-${user.id}`} value={selectedRole} onChange={(event) => setRoleEdits((current) => ({ ...current, [user.id]: event.target.value as DashboardRole }))} disabled={isUpdatingRole || isDeleting}><option value="ORGANIZER">Organizador</option><option value="ADMINISTRATOR">Administrador</option></select><button className="text-button" type="button" onClick={() => updateRole(user)} disabled={selectedRole === user.role || isUpdatingRole || isDeleting}>{isUpdatingRole ? "Salvando…" : "Salvar nível"}</button></>}</div>
          <div className="access-user-status"><strong className={user.mustSetPassword ? "awaiting" : "ready"}>{user.mustSetPassword ? "Aguardando senha" : "Ativo"}</strong><small>{user.mustSetPassword ? `Código gerado: ${formatDate(user.activationCodeCreatedAt)}` : `Senha definida: ${formatDate(user.passwordSetAt)}`}</small></div>
          <div className="access-user-actions"><button className="outline-button" type="button" onClick={() => resetPassword(user)} disabled={resettingId === user.id || isDeleting}>{resettingId === user.id ? "Gerando…" : "Redefinir senha"}</button>{!isCurrentUser && <button className="danger-button" type="button" onClick={() => { setError(null); setDeleteTarget(user); }} disabled={isUpdatingRole || isDeleting}>{isDeleting ? "Excluindo…" : "Excluir"}</button>}</div>
        </article>;
        })}
      </div>
    </section>
    {deleteTarget && <div className="modal-backdrop" role="presentation">
      <section className="confirmation-modal" role="dialog" aria-modal="true" aria-labelledby={`delete-access-title-${deleteTarget.id}`}>
        <p className="section-kicker">Excluir acesso</p>
        <h2 id={`delete-access-title-${deleteTarget.id}`}>Excluir “{deleteTarget.email}”?</h2>
        <p>A conta será removida do DataRun e não poderá mais entrar no sistema. Para devolver o acesso depois, será necessário cadastrar o e-mail novamente e gerar outro código de ativação.</p>
        {error && <p className="modal-error">{error}</p>}
        <div className="modal-actions">
          <button className="outline-button" type="button" onClick={() => setDeleteTarget(null)} disabled={deletingId === deleteTarget.id}>Cancelar</button>
          <button className="danger-button confirm-delete-button" type="button" onClick={deleteAccess} disabled={deletingId === deleteTarget.id}>{deletingId === deleteTarget.id ? "Excluindo…" : "Excluir acesso"}</button>
        </div>
      </section>
    </div>}
  </div>;
}
