"use client";

import { useEffect, useState } from "react";

type ConnectionStatus = "connected" | "error" | "waiting";

const labels: Record<ConnectionStatus, string> = {
  connected: "Conectada",
  error: "Verificar",
  waiting: "Aguardando",
};

export function SocialConnectionStatus() {
  const [status, setStatus] = useState<ConnectionStatus>("waiting");

  useEffect(() => {
    let isCurrent = true;

    fetch("/api/integrations/instagram/status", { cache: "no-store" })
      .then(async (response) => {
        if (!response.ok) return;
        const payload = await response.json() as { status?: ConnectionStatus };
        if (isCurrent && payload.status && labels[payload.status]) setStatus(payload.status);
      })
      .catch(() => {
        // The sidebar keeps its neutral state when the status cannot be loaded.
      });

    return () => { isCurrent = false; };
  }, []);

  return <b className={`system-status-${status}`}>{labels[status]}</b>;
}
