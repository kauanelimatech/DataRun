"use client";

import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export function ActivationPasswordForm() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [isReady, setIsReady] = useState<boolean | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/auth/activation/password", { cache: "no-store" })
      .then((response) => {
        setIsReady(response.ok);
        if (!response.ok) return response.json().then((payload: { error?: string }) => setError(payload.error || "A ativação não está disponível."));
      })
      .catch(() => {
        setIsReady(false);
        setError("Não foi possível validar a ativação agora.");
      });
  }, []);

  async function setInitialPassword(event: FormEvent<HTMLFormElement>) {
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
      const response = await fetch("/api/auth/activation/password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      const payload = await response.json().catch(() => null) as { error?: string; email?: string } | null;
      if (!response.ok) throw new Error(payload?.error || "Não foi possível definir a senha.");

      if (!payload?.email) throw new Error("A senha foi definida, mas não foi possível iniciar o painel.");
      const supabase = createClient();
      const { error: signInError } = await supabase.auth.signInWithPassword({ email: payload.email, password });
      if (signInError) throw new Error("A senha foi definida. Faça login com a nova senha para continuar.");

      router.replace("/");
      router.refresh();
    } catch (activationError) {
      setError(activationError instanceof Error ? activationError.message : "Não foi possível definir a senha.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return <main className="login-page"><section className="login-card"><span className="login-mark">↗</span><p className="section-kicker">DataRun</p><h1>Crie sua senha</h1><p>Confirme uma senha exclusiva para acessar o painel. Ela precisa ter pelo menos 12 caracteres.</p>{isReady === null ? <p className="login-status">Validando o código de ativação…</p> : isReady ? <form onSubmit={setInitialPassword}><label>Nova senha<input type="password" autoComplete="new-password" minLength={12} value={password} onChange={(event) => setPassword(event.target.value)} required /></label><label>Confirmar nova senha<input type="password" autoComplete="new-password" minLength={12} value={confirmation} onChange={(event) => setConfirmation(event.target.value)} required /></label>{error && <p className="login-error" role="alert">{error}</p>}<button className="primary-button" type="submit" disabled={isSubmitting}>{isSubmitting ? "Salvando…" : "Criar senha"}</button></form> : <><p className="login-error" role="alert">{error || "A ativação não está disponível."}</p><Link className="login-link" href="/login">Voltar ao login</Link></>}</section></main>;
}
