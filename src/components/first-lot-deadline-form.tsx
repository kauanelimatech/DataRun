"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";

type FirstLotDeadlineFormProps = {
  eventId: string;
  initialEventDate: string | null;
  initialDate: string | null;
};

export function FirstLotDeadlineForm({ eventId, initialEventDate, initialDate }: FirstLotDeadlineFormProps) {
  const router = useRouter();
  const [eventDate, setEventDate] = useState(initialEventDate ?? "");
  const [date, setDate] = useState(initialDate ?? "");
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function saveDeadline(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSaving(true);
    setMessage("");
    setError("");
    try {
      const response = await fetch(`/api/events/${eventId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ eventDate, firstLotEndsOn: date }),
      });
      const payload = await response.json().catch(() => null) as { error?: string; eventDate?: string | null; firstLotEndsOn?: string | null } | null;
      if (!response.ok) throw new Error(payload?.error || "Não foi possível salvar as datas do evento.");
      setEventDate(payload?.eventDate ?? "");
      setDate(payload?.firstLotEndsOn ?? "");
      setMessage("Datas salvas.");
      router.refresh();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Não foi possível salvar as datas do evento.");
    } finally {
      setIsSaving(false);
    }
  }

  return <form className="lot-deadline-form" onSubmit={saveDeadline}>
    <label>Data do evento<input type="date" value={eventDate} onChange={(event) => setEventDate(event.target.value)} disabled={isSaving} /></label>
    <label>Fim do 1º lote<input type="date" value={date} onChange={(event) => setDate(event.target.value)} disabled={isSaving} /></label>
    <button className="outline-button" type="submit" disabled={isSaving}>{isSaving ? "Salvando…" : "Salvar"}</button>
    {message && <small className="lot-deadline-success">{message}</small>}
    {error && <small className="lot-deadline-error">{error}</small>}
  </form>;
}
