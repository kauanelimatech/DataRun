"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export function LoginForm() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [activationCode, setActivationCode] = useState("");
  const [needsActivationCode, setNeedsActivationCode] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function signIn(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSubmitting(true);
    setError(null);

    try {
      if (!password) {
        const response = await fetch("/api/auth/activation/start", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email, code: activationCode || undefined }),
        });
        const payload = await response.json().catch(() => null) as { error?: string; requiresActivationCode?: boolean } | null;
        if (!response.ok) {
          setError(payload?.error || "Informe sua senha para acessar o painel.");
          return;
        }
        if (payload?.requiresActivationCode) {
          setNeedsActivationCode(true);
          setError(null);
          return;
        }
        router.replace("/ativar-acesso");
        router.refresh();
        return;
      }

      const supabase = createClient();
      const { data, error: signInError } = await supabase.auth.signInWithPassword({ email, password });

      if (signInError) {
        setError(signInError.message || "Não foi possível acessar o painel. Confira seu e-mail e senha.");
        return;
      }

      if (!data.session) {
        setError("A conta foi validada, mas não foi criada uma sessão. Confirme o e-mail da conta no Supabase e tente novamente.");
        return;
      }

      router.replace("/");
      router.refresh();
    } catch {
      setError("Não foi possível acessar o Supabase. Verifique a URL e a Publishable Key no arquivo .env.local e reinicie o servidor.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return <main className="login-page"><section className="login-card"><span className="login-mark">↗</span><p className="section-kicker">DataRun</p><h1>Acesse o painel</h1><p>Entre com o e-mail e a senha da conta autorizada. No primeiro acesso, deixe a senha vazia e informe o código fornecido pelo administrador.</p><form onSubmit={signIn}><label>E-mail<input type="email" autoComplete="email" value={email} onChange={(event) => { setEmail(event.target.value); setNeedsActivationCode(false); setActivationCode(""); }} required /></label><label>Senha<input type="password" autoComplete="current-password" value={password} onChange={(event) => { setPassword(event.target.value); if (event.target.value) setNeedsActivationCode(false); }} /></label>{needsActivationCode && <label>Código de ativação<input type="text" autoComplete="one-time-code" value={activationCode} onChange={(event) => setActivationCode(event.target.value)} placeholder="DR-0000-0000-0000-0000-0000-0000" required /></label>}{error && <p className="login-error" role="alert">{error}</p>}<button className="primary-button" type="submit" disabled={isSubmitting}>{isSubmitting ? "Validando…" : needsActivationCode ? "Validar código" : "Entrar"}</button></form><Link className="login-link" href="/recuperar-senha">Preciso de um novo acesso</Link></section></main>;
}
