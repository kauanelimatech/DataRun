"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type DeleteEventButtonProps = {
  eventId: string;
  eventName: string;
  registrationCount: number;
};

export function DeleteEventButton({ eventId, eventName, registrationCount }: DeleteEventButtonProps) {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [error, setError] = useState("");

  async function deleteEvent() {
    setIsDeleting(true);
    setError("");
    try {
      const response = await fetch(`/api/events/${eventId}`, { method: "DELETE" });
      const payload = await response.json() as { error?: string };
      if (!response.ok) throw new Error(payload.error ?? "Não foi possível excluir o evento.");
      setIsOpen(false);
      router.refresh();
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : "Não foi possível excluir o evento.");
    } finally {
      setIsDeleting(false);
    }
  }

  return <>
    <button className="danger-button" type="button" onClick={() => { setError(""); setIsOpen(true); }}>Excluir</button>
    {isOpen && <div className="modal-backdrop" role="presentation">
      <section className="confirmation-modal" role="dialog" aria-modal="true" aria-labelledby={`delete-event-title-${eventId}`}>
        <p className="section-kicker">Excluir evento</p>
        <h2 id={`delete-event-title-${eventId}`}>Excluir “{eventName}”?</h2>
        <p>Esta ação remove {registrationCount.toLocaleString("pt-BR")} inscrição(ões) e os vínculos deste evento com posts do Instagram.</p>
        <p>O histórico técnico da importação será mantido, mas não poderá restaurar o evento ou as inscrições.</p>
        {error && <p className="modal-error">{error}</p>}
        <div className="modal-actions">
          <button className="outline-button" type="button" onClick={() => setIsOpen(false)} disabled={isDeleting}>Cancelar</button>
          <button className="danger-button confirm-delete-button" type="button" onClick={deleteEvent} disabled={isDeleting}>{isDeleting ? "Excluindo…" : "Excluir evento"}</button>
        </div>
      </section>
    </div>}
  </>;
}
