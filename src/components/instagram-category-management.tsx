"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type CategorySummary = {
  id: string;
  name: string;
  confirmedPosts: number;
  suggestedPosts: number;
};

type Category = {
  id: string;
  name: string;
};

type CategorizedPost = {
  postId: string;
  caption: string | null;
  permalink: string | null;
  publishedAt: string;
  mediaType: string;
};

type ActiveCategory = {
  id: string;
  name: string;
  isUnclassified?: boolean;
};

function formattedDate(value: string) {
  return new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "short", year: "numeric", timeZone: "UTC" }).format(new Date(value));
}

function previewCaption(value: string | null) {
  if (!value) return "Sem legenda disponível para esta publicação.";
  return value.length > 210 ? `${value.slice(0, 210).trimEnd()}…` : value;
}

export function InstagramCategoryManagement({ categories, reviewCategories, unclassifiedPostCount }: {
  categories: CategorySummary[];
  reviewCategories: Category[];
  unclassifiedPostCount: number;
}) {
  const router = useRouter();
  const [activeCategory, setActiveCategory] = useState<ActiveCategory | null>(null);
  const [posts, setPosts] = useState<CategorizedPost[]>([]);
  const [total, setTotal] = useState(0);
  const [nextOffset, setNextOffset] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedCategories, setSelectedCategories] = useState<Record<string, string>>({});
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [error, setError] = useState("");

  async function loadPosts(category: ActiveCategory, offset = 0, append = false) {
    setIsLoading(true);
    setError("");
    try {
      const response = await fetch(`/api/integrations/instagram/categories/${category.id}/posts?offset=${offset}`, { cache: "no-store" });
      const payload = await response.json().catch(() => null) as { error?: string; posts?: CategorizedPost[]; total?: number; nextOffset?: number | null } | null;
      if (!response.ok || !payload?.posts) throw new Error(payload?.error || "Não foi possível carregar os posts desta categoria.");
      setPosts((current) => append ? [...current, ...payload.posts!] : payload.posts!);
      setTotal(payload.total ?? 0);
      setNextOffset(payload.nextOffset ?? null);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Não foi possível carregar os posts desta categoria.");
      if (!append) {
        setPosts([]);
        setTotal(0);
        setNextOffset(null);
      }
    } finally {
      setIsLoading(false);
    }
  }

  function openCategory(category: ActiveCategory) {
    setActiveCategory(category);
    setSelectedCategories({});
    setPosts([]);
    setTotal(0);
    setNextOffset(null);
    void loadPosts(category);
  }

  function selectedFor(post: CategorizedPost) {
    if (selectedCategories[post.postId]) return selectedCategories[post.postId];
    return activeCategory?.isUnclassified ? "" : activeCategory?.id ?? "";
  }

  async function saveCategory(post: CategorizedPost) {
    const categoryId = selectedFor(post);
    if (!categoryId || !activeCategory) return;

    setProcessingId(post.postId);
    setError("");
    try {
      const response = await fetch("/api/integrations/instagram/categories/review", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ postId: post.postId, action: "confirm", categoryIds: [categoryId] }),
      });
      const payload = await response.json().catch(() => null) as { error?: string } | null;
      if (!response.ok) throw new Error(payload?.error || "Não foi possível salvar a categoria.");

      if (activeCategory.isUnclassified || categoryId !== activeCategory.id) {
        setPosts((current) => current.filter((currentPost) => currentPost.postId !== post.postId));
        setTotal((current) => Math.max(0, current - 1));
      }
      router.refresh();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Não foi possível salvar a categoria.");
    } finally {
      setProcessingId(null);
    }
  }

  return <>
    <section className="category-grid category-grid-interactive" aria-label="Categorias de conteúdo">
      {categories.map((category) => <button className={`category-card category-card-button ${activeCategory?.id === category.id ? "selected" : ""}`} type="button" key={category.id} onClick={() => openCategory({ id: category.id, name: category.name })}>
        <div className="category-card-heading"><span className="category-mark">#</span><h2>{category.name}</h2></div>
        <div className="category-counts"><p><strong>{category.confirmedPosts.toLocaleString("pt-BR")}</strong> confirmados</p><p><strong>{category.suggestedPosts.toLocaleString("pt-BR")}</strong> aguardando revisão</p></div>
      </button>)}
      <button className={`category-card category-card-button unclassified ${activeCategory?.id === "unclassified" ? "selected" : ""}`} type="button" onClick={() => openCategory({ id: "unclassified", name: "Sem categoria", isUnclassified: true })}>
        <div className="category-card-heading"><span className="category-mark">!</span><h2>Sem categoria</h2></div>
        <div className="category-counts"><p><strong>{unclassifiedPostCount.toLocaleString("pt-BR")}</strong> sem confirmação</p><p><strong>Clique para classificar</strong></p></div>
      </button>
    </section>

    {activeCategory && <section className="instagram-review-panel category-posts-panel">
      <div className="review-heading"><div><p className="section-kicker">Conferência por categoria</p><h2>{activeCategory.name}</h2><p>{isLoading && posts.length === 0 ? "Carregando posts…" : `${total.toLocaleString("pt-BR")} post(s) nesta lista. Escolha uma única tag e salve para mover a publicação automaticamente.`}</p></div><button className="outline-button" type="button" onClick={() => { setActiveCategory(null); setPosts([]); setError(""); }}>Fechar lista</button></div>
      {error && <p className="review-error">{error}</p>}
      {!isLoading && posts.length === 0 && !error && <p className="empty-copy">Nenhum post nesta categoria.</p>}
      <div className="review-list">
        {posts.map((post) => {
          const selectedCategoryId = selectedFor(post);
          const isProcessing = processingId === post.postId;
          return <article className="review-post" key={post.postId}>
            <div className="review-post-meta"><span>{post.mediaType}</span><time dateTime={post.publishedAt}>{formattedDate(post.publishedAt)}</time></div>
            <p className="review-caption">{previewCaption(post.caption)}</p>
            <div className="review-tags" aria-label="Categorias do post">{reviewCategories.map((category) => <button className={`review-tag ${selectedCategoryId === category.id ? "selected" : ""}`} type="button" key={category.id} onClick={() => setSelectedCategories((current) => ({ ...current, [post.postId]: category.id }))} disabled={isProcessing} aria-pressed={selectedCategoryId === category.id}>{category.name}</button>)}</div>
            <div className="review-controls">{post.permalink && <a href={post.permalink} target="_blank" rel="noreferrer">Abrir post ↗</a>}<div className="review-actions"><button className="primary-button" type="button" onClick={() => saveCategory(post)} disabled={isProcessing || !selectedCategoryId}>{isProcessing ? "Salvando…" : "Salvar categoria"}</button></div></div>
          </article>;
        })}
      </div>
      {nextOffset !== null && <div className="category-load-more"><button className="outline-button" type="button" disabled={isLoading} onClick={() => void loadPosts(activeCategory, nextOffset, true)}>{isLoading ? "Carregando…" : "Carregar mais posts"}</button></div>}
    </section>}
  </>;
}
