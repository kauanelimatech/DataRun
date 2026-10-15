"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export function LoginForm() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function signIn(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSubmitting(true);
    setError(null);

    try {
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

      router.replace("/importacoes");
      router.refresh();
    } catch {
      setError("Não foi possível acessar o Supabase. Verifique a URL e a Publishable Key no arquivo .env.local e reinicie o servidor.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return <main className="login-page"><section className="login-card"><span className="login-mark">↗</span><p className="section-kicker">DataRun</p><h1>Acesse o painel</h1><p>Entre com a conta autorizada para importar e consultar os dados dos eventos.</p><form onSubmit={signIn}><label>E-mail<input type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} required /></label><label>Senha<input type="password" autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} required /></label>{error && <p className="login-error" role="alert">{error}</p>}<button className="primary-button" type="submit" disabled={isSubmitting}>{isSubmitting ? "Entrando…" : "Entrar"}</button></form></section></main>;
}
