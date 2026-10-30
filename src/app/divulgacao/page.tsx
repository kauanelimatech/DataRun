import { DashboardShell } from "@/components/dashboard-shell";
import { InstagramCategoryManagement } from "@/components/instagram-category-management";
import { InstagramReviewQueue } from "@/components/instagram-review-queue";
import { InstagramSyncButton } from "@/components/instagram-sync-button";
import { requireUser } from "@/lib/auth/require-user";
import { getInstagramContentSummary, getInstagramReviewCategories, getInstagramReviewQueue } from "@/lib/instagram-data";

export default async function OutreachPage() {
  const access = await requireUser();
  const canManage = access.role === "ADMINISTRATOR";
  const [content, suggestions, categories] = await Promise.all([
    getInstagramContentSummary(),
    getInstagramReviewQueue(),
    getInstagramReviewCategories(),
  ]);
  const socialConnectionStatus = content.connection?.status === "connected" || content.connection?.status === "error"
    ? content.connection.status
    : "waiting";

  return (
    <DashboardShell
      title="Posts do Instagram"
      description="Classificação editorial e métricas dos conteúdos publicados."
      socialConnectionStatus={socialConnectionStatus}
      role={access.role}
    >
      <section className="content-taxonomy-intro">
        <div>
          <p className="section-kicker">Taxonomia editorial</p>
          <h2>Categorias que ajudam a entender o que publicar</h2>
          <p>
            Cada publicação recebe uma única categoria. O DataRun cria sugestões a partir da legenda,
            hashtags, transcrição e descrição visual, que devem ser revisadas antes de entrarem nos relatórios.
          </p>
        </div>
        <div className="taxonomy-status">
          {content.connection?.status === "connected" ? <><strong>Conectado</strong><span>{content.connection.username ? `@${content.connection.username}` : "Conta profissional"}</span></> : <><strong>Não conectado</strong><span>Instagram aguardando</span></>}
        </div>
      </section>

      <section className="instagram-connection-panel">
        <div>
          <p className="section-kicker">Fonte de dados</p>
          <h2>{content.connection?.status === "connected" ? "Conta do Instagram autorizada" : "Conecte a conta profissional do Instagram"}</h2>
          <p>{content.connection?.status === "connected" ? "A sincronização importa posts, métricas disponíveis e sugestões de categoria." : "A autorização é feita diretamente pela Meta. O token será criptografado antes de ser salvo."}</p>
        </div>
        {canManage && (content.connection?.status === "connected" ? <InstagramSyncButton /> : <a className="primary-button" href="/api/integrations/instagram/connect">Conectar Instagram</a>)}
      </section>

      {canManage ? <InstagramCategoryManagement
        categories={content.categories}
        reviewCategories={categories}
        unclassifiedPostCount={content.unclassifiedPostCount}
      /> : <section className="category-grid" aria-label="Categorias de conteúdo">
        {content.categories.map((category) => (
          <article className="category-card" key={category.id}>
            <div className="category-card-heading">
              <span className="category-mark">#</span>
              <h2>{category.name}</h2>
            </div>
            <div className="category-counts">
              <p><strong>{category.confirmedPosts.toLocaleString("pt-BR")}</strong> confirmados</p>
              <p><strong>{category.suggestedPosts.toLocaleString("pt-BR")}</strong> aguardando revisão</p>
            </div>
          </article>
        ))}
      </section>}

      {canManage && <InstagramReviewQueue
        suggestions={suggestions}
        categories={categories}
        pendingReviewCount={content.categories.reduce((total, category) => total + category.suggestedPosts, 0)}
      />}

      {content.postCount === 0 && (
        <section className="empty-state-panel">
          <span>◎</span>
          <h2>A taxonomia está pronta para receber os posts</h2>
          <p>
            Quando a fonte do Instagram for conectada, os posts importados receberão sugestões automáticas
            dessas categorias. Os indicadores de alcance, engajamento e conversão serão exibidos aqui após a coleta.
          </p>
        </section>
      )}
    </DashboardShell>
  );
}
