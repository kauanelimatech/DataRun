"use client";

import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export function PasswordUpdateForm() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [hasActiveSession, setHasActiveSession] = useState(false);
  const [isCheckingSession, setIsCheckingSession] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const supabase = createClient();
    const { data: listener } = supabase.auth.onAuthStateChange((event, session) => {
      if ((event === "PASSWORD_RECOVERY" || event === "SIGNED_IN") && session) setHasActiveSession(true);
      if (event === "SIGNED_OUT") setHasActiveSession(false);
      setIsCheckingSession(false);
    });

    supabase.auth.getSession().then(({ data }) => {
      setHasActiveSession(Boolean(data.session));
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
      const completion = await fetch("/api/auth/password-completed", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      const completionPayload = await completion.json().catch(() => null) as { error?: string } | null;
      if (!completion.ok) {
        setError(completionPayload?.error || "A senha foi atualizada, mas não foi possível liberar o painel.");
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

  return <main className="login-page"><section className="login-card"><span className="login-mark">↗</span><p className="section-kicker">DataRun</p><h1>Defina uma nova senha</h1><p>Escolha uma senha nova, exclusiva para o DataRun, com pelo menos 12 caracteres.</p>{isCheckingSession ? <p className="login-status">Validando o link de acesso…</p> : hasActiveSession ? <form onSubmit={updatePassword}><label>Nova senha<input type="password" autoComplete="new-password" minLength={12} value={password} onChange={(event) => setPassword(event.target.value)} required /></label><label>Confirmar nova senha<input type="password" autoComplete="new-password" minLength={12} value={confirmation} onChange={(event) => setConfirmation(event.target.value)} required /></label>{error && <p className="login-error" role="alert">{error}</p>}<button className="primary-button" type="submit" disabled={isSubmitting}>{isSubmitting ? "Salvando…" : "Salvar nova senha"}</button></form> : <><p className="login-error" role="alert">O link de acesso é inválido ou expirou. Solicite um novo link ao administrador do DataRun.</p><Link className="login-link" href="/login">Voltar ao login</Link></>}</section></main>;
}
