"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { InstagramReviewCategory, InstagramSuggestedPost } from "@/lib/instagram-data";

type ReviewAction = "confirm" | "reject";

type InstagramReviewQueueProps = {
  suggestions: InstagramSuggestedPost[];
  categories: InstagramReviewCategory[];
  pendingReviewCount: number;
};

function formattedDate(value: string) {
  return new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "short", year: "numeric", timeZone: "UTC" }).format(new Date(value));
}

function previewCaption(value: string | null) {
  if (!value) return "Sem legenda disponível para esta publicação.";
  return value.length > 210 ? `${value.slice(0, 210).trimEnd()}…` : value;
}

export function InstagramReviewQueue({ suggestions, categories, pendingReviewCount }: InstagramReviewQueueProps) {
  const router = useRouter();
  const [selectedCategories, setSelectedCategories] = useState<Record<string, string[]>>({});
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [error, setError] = useState("");

  function selectedFor(suggestion: InstagramSuggestedPost) {
    return selectedCategories[suggestion.postId] ?? suggestion.suggestedCategories.slice(0, 1).map((category) => category.id);
  }

  function selectCategory(postId: string, categoryId: string) {
    setSelectedCategories((selected) => ({
      ...selected,
      [postId]: [categoryId],
    }));
  }

  async function review(suggestion: InstagramSuggestedPost, action: ReviewAction) {
    setProcessingId(suggestion.postId);
    setError("");
    try {
      const response = await fetch("/api/integrations/instagram/categories/review", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          postId: suggestion.postId,
          action,
          categoryIds: action === "confirm" ? selectedFor(suggestion) : [],
        }),
      });
      const payload = await response.json() as { error?: string };
      if (!response.ok) throw new Error(payload.error ?? "Não foi possível registrar a revisão.");
      router.refresh();
    } catch (reviewError) {
      setError(reviewError instanceof Error ? reviewError.message : "Não foi possível registrar a revisão.");
    } finally {
      setProcessingId(null);
    }
  }

  if (pendingReviewCount === 0) {
    return <section className="instagram-review-panel"><div className="review-heading"><div><p className="section-kicker">Revisão editorial</p><h2>Todas as sugestões foram revisadas</h2><p>As categorias confirmadas já podem alimentar as análises de conteúdo.</p></div></div></section>;
  }

  return (
    <section className="instagram-review-panel">
      <div className="review-heading">
        <div>
          <p className="section-kicker">Revisão editorial</p>
          <h2>Confirme as categorias dos posts</h2>
          <p>{pendingReviewCount.toLocaleString("pt-BR")} classificação(ões) aguardando revisão. Selecione uma única tag e confirme o post.</p>
        </div>
      </div>
      {error && <p className="review-error">{error}</p>}
      <div className="review-list">
        {suggestions.map((suggestion) => {
          const selected = selectedFor(suggestion);
          const isProcessing = processingId === suggestion.postId;
          return <article className="review-post" key={suggestion.postId}>
            <div className="review-post-meta"><span>{suggestion.mediaType}</span><time dateTime={suggestion.publishedAt}>{formattedDate(suggestion.publishedAt)}</time></div>
            <p className="review-caption">{previewCaption(suggestion.caption)}</p>
            <div className="review-tags" aria-label="Categorias do post">
              {categories.map((category) => {
                const suggested = suggestion.suggestedCategories.find((item) => item.id === category.id);
                const isSelected = selected.includes(category.id);
                return <button className={`review-tag ${isSelected ? "selected" : ""} ${suggested ? "suggested" : ""}`} type="button" key={category.id} onClick={() => selectCategory(suggestion.postId, category.id)} disabled={isProcessing} aria-pressed={isSelected}>{category.name}{suggested?.confidence !== null && suggested?.confidence !== undefined && <small>{Math.round(suggested.confidence * 100)}%</small>}</button>;
              })}
            </div>
            <div className="review-controls">
              {suggestion.permalink && <a href={suggestion.permalink} target="_blank" rel="noreferrer">Abrir post ↗</a>}
              <div className="review-actions"><button className="outline-button" type="button" onClick={() => review(suggestion, "reject")} disabled={isProcessing}>Rejeitar todas</button><button className="primary-button" type="button" onClick={() => review(suggestion, "confirm")} disabled={isProcessing || selected.length === 0}>{isProcessing ? "Salvando…" : "Confirmar tags"}</button></div>
            </div>
          </article>;
        })}
      </div>
    </section>
  );
}
