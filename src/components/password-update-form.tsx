"use client";

import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export function PasswordUpdateForm() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [isRecoverySession, setIsRecoverySession] = useState(false);
  const [isCheckingSession, setIsCheckingSession] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const supabase = createClient();
    const { data: listener } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "PASSWORD_RECOVERY" && session) setIsRecoverySession(true);
      if (event === "SIGNED_OUT") setIsRecoverySession(false);
      setIsCheckingSession(false);
    });

    supabase.auth.getSession().then(({ data }) => {
      setIsRecoverySession(Boolean(data.session));
      setIsCheckingSession(false);
    });

    return () => listener.subscription.unsubscribe();
  }, []);

  async function updatePassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    if (password.length < 12) {
      setError("Use uma senha com pelo menos 12 caracteres.");
      return;
    }
    if (password !== confirmation) {
      setError("As senhas não coincidem.");
      return;
    }

    setIsSubmitting(true);
    try {
      const supabase = createClient();
      const { error: updateError } = await supabase.auth.updateUser({ password });
      if (updateError) {
        setError(updateError.message || "Não foi possível atualizar a senha.");
        return;
      }
      router.replace("/");
      router.refresh();
    } catch {
      setError("Não foi possível atualizar a senha. Solicite um novo link de recuperação.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return <main className="login-page"><section className="login-card"><span className="login-mark">↗</span><p className="section-kicker">DataRun</p><h1>Defina uma nova senha</h1><p>Escolha uma senha nova, exclusiva para o DataRun, com pelo menos 12 caracteres.</p>{isCheckingSession ? <p className="login-status">Validando o link de recuperação…</p> : isRecoverySession ? <form onSubmit={updatePassword}><label>Nova senha<input type="password" autoComplete="new-password" minLength={12} value={password} onChange={(event) => setPassword(event.target.value)} required /></label><label>Confirmar nova senha<input type="password" autoComplete="new-password" minLength={12} value={confirmation} onChange={(event) => setConfirmation(event.target.value)} required /></label>{error && <p className="login-error" role="alert">{error}</p>}<button className="primary-button" type="submit" disabled={isSubmitting}>{isSubmitting ? "Salvando…" : "Salvar nova senha"}</button></form> : <><p className="login-error" role="alert">O link de recuperação é inválido ou expirou. Solicite um novo link.</p><Link className="login-link" href="/recuperar-senha">Solicitar novo link</Link></>}</section></main>;
}
