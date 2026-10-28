"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import { createClient } from "@/lib/supabase/client";

export function PasswordRecoveryRequestForm() {
  const [email, setEmail] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSent, setIsSent] = useState(false);

  async function requestRecovery(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSubmitting(true);
    setError(null);

    try {
      const supabase = createClient();
      const { error: recoveryError } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/atualizar-senha`,
      });
      if (recoveryError) {
        setError(recoveryError.message || "Não foi possível enviar o e-mail de recuperação.");
        return;
      }
      setIsSent(true);
    } catch {
      setError("Não foi possível acessar o Supabase. Verifique a configuração do ambiente e tente novamente.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return <main className="login-page"><section className="login-card"><span className="login-mark">↗</span><p className="section-kicker">DataRun</p><h1>Recupere sua senha</h1><p>Informe o e-mail da conta autorizada. Se ele estiver cadastrado, enviaremos um link seguro para definir uma nova senha.</p>{isSent ? <div className="login-success" role="status">Verifique sua caixa de entrada e siga o link recebido. O link expira após o uso ou no prazo definido pelo Supabase.</div> : <form onSubmit={requestRecovery}><label>E-mail<input type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} required /></label>{error && <p className="login-error" role="alert">{error}</p>}<button className="primary-button" type="submit" disabled={isSubmitting}>{isSubmitting ? "Enviando…" : "Enviar link de recuperação"}</button></form>}<Link className="login-link" href="/login">Voltar ao login</Link></section></main>;
}
