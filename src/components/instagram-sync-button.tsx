"use client";

import { useState } from "react";

export function InstagramSyncButton() {
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [message, setMessage] = useState("");

  async function sync() {
    setStatus("loading");
    setMessage("");
    try {
      const response = await fetch("/api/integrations/instagram/sync", { method: "POST" });
      const payload = await response.json() as { importedPosts?: number; error?: string };
      if (!response.ok) throw new Error(payload.error ?? "Não foi possível sincronizar o Instagram.");
      setStatus("success");
      setMessage(`${payload.importedPosts ?? 0} posts sincronizados. Atualize a página para ver as categorias.`);
    } catch (error) {
      setStatus("error");
      setMessage(error instanceof Error ? error.message : "Não foi possível sincronizar o Instagram.");
    }
  }

  return <div className="instagram-sync-action"><button className="primary-button" type="button" onClick={sync} disabled={status === "loading"}>{status === "loading" ? "Sincronizando…" : "Sincronizar agora"}</button>{message && <p className={status}>{message}</p>}</div>;
}
