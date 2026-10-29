"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { InstagramReviewCategory, InstagramSuggestedPost } from "@/lib/instagram-data";

type ReviewAction = "confirm" | "reject" | "recategorize";

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
  const [selectedCategories, setSelectedCategories] = useState<Record<string, string>>({});
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [error, setError] = useState("");

  async function review(suggestion: InstagramSuggestedPost, action: ReviewAction) {
    setProcessingId(suggestion.postId);
    setError("");
    const replacementCategoryId = selectedCategories[suggestion.postId] ?? suggestion.categoryId;
    const resolvedAction = action === "confirm" && replacementCategoryId !== suggestion.categoryId ? "recategorize" : action;

    try {
      const response = await fetch("/api/integrations/instagram/categories/review", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          postId: suggestion.postId,
          categoryId: suggestion.categoryId,
          action: resolvedAction,
          replacementCategoryId: resolvedAction === "recategorize" ? replacementCategoryId : undefined,
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
          <h2>Confirme as sugestões antes dos relatórios</h2>
          <p>{pendingReviewCount.toLocaleString("pt-BR")} sugestão(ões) aguardando revisão. Esta lista mostra as próximas {suggestions.length}.</p>
        </div>
      </div>
      {error && <p className="review-error">{error}</p>}
      <div className="review-list">
        {suggestions.map((suggestion) => {
          const selectedCategoryId = selectedCategories[suggestion.postId] ?? suggestion.categoryId;
          const isProcessing = processingId === suggestion.postId;
          return <article className="review-post" key={`${suggestion.postId}-${suggestion.categoryId}`}>
            <div className="review-post-meta"><span>{suggestion.mediaType}</span><time dateTime={suggestion.publishedAt}>{formattedDate(suggestion.publishedAt)}</time></div>
            <p className="review-caption">{previewCaption(suggestion.caption)}</p>
            <div className="review-controls">
              <label>Categoria
                <select value={selectedCategoryId} onChange={(event) => setSelectedCategories((current) => ({ ...current, [suggestion.postId]: event.target.value }))} disabled={isProcessing}>
                  {categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}
                </select>
              </label>
              <span className="review-suggestion">Sugestão: <strong>{suggestion.categoryName}</strong>{suggestion.confidence !== null && <> · {Math.round(suggestion.confidence * 100)}%</>}</span>
              {suggestion.permalink && <a href={suggestion.permalink} target="_blank" rel="noreferrer">Abrir post ↗</a>}
              <div className="review-actions"><button className="outline-button" type="button" onClick={() => review(suggestion, "reject")} disabled={isProcessing}>Rejeitar</button><button className="primary-button" type="button" onClick={() => review(suggestion, "confirm")} disabled={isProcessing}>{isProcessing ? "Salvando…" : selectedCategoryId === suggestion.categoryId ? "Confirmar" : "Confirmar alteração"}</button></div>
            </div>
          </article>;
        })}
      </div>
    </section>
  );
}
