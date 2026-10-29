import Link from "next/link";

export function PasswordRecoveryRequestForm() {
  return <main className="login-page"><section className="login-card"><span className="login-mark">↗</span><p className="section-kicker">DataRun</p><h1>Solicite um novo acesso</h1><p>O DataRun não envia e-mails automáticos neste momento. Peça ao administrador do painel para gerar um novo código de ativação.</p><div className="login-status">O código é individual, expira em até 72 horas e deve ser compartilhado apenas com o titular da conta.</div><Link className="login-link" href="/login">Voltar ao login</Link></section></main>;
}
