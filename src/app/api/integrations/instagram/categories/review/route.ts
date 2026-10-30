import { getApiUserAccess, isAdministrator } from "@/lib/auth/access";
import { revalidateDashboardData } from "@/lib/dashboard-data";
import { revalidateInstagramContentSummary } from "@/lib/instagram-data";
import { createAdminClient } from "@/lib/supabase/admin";
import { revalidatePath } from "next/cache";

export const dynamic = "force-dynamic";

function jsonError(message: string, status: number) {
  return Response.json({ error: message }, { status });
}

function isUuid(value: unknown): value is string {
  return typeof value === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

export async function PATCH(request: Request) {
  const access = await getApiUserAccess();
  if (!access) return jsonError("Faça login para revisar as categorias.", 401);
  if (!isAdministrator(access)) return jsonError("Somente administradores podem revisar as categorias.", 403);

  const body = await request.json().catch(() => null) as {
    postId?: unknown;
    action?: unknown;
    categoryIds?: unknown;
  } | null;
  const categoryIds = Array.isArray(body?.categoryIds) ? body.categoryIds : [];
  if (!isUuid(body?.postId) || !["confirm", "reject"].includes(String(body?.action)) || !categoryIds.every(isUuid)) {
    return jsonError("A revisão enviada não é válida.", 400);
  }
  if (body?.action === "confirm" && categoryIds.length !== 1) {
    return jsonError("Selecione exatamente uma categoria ou rejeite a sugestão.", 400);
  }

  const admin = createAdminClient();
  if (body?.action === "confirm") {
    const uniqueCategoryIds = [...new Set(categoryIds)];
    if (uniqueCategoryIds.length !== 1) return jsonError("Selecione exatamente uma categoria.", 400);
    const { data: activeCategories, error: categoryError } = await admin
      .from("content_categories")
      .select("id")
      .eq("is_active", true)
      .in("id", uniqueCategoryIds);
    if (categoryError || activeCategories?.length !== uniqueCategoryIds.length) {
      return jsonError("Uma das categorias escolhidas não está disponível.", 400);
    }

    const timestamp = new Date().toISOString();
    const { error: rejectPreviousError } = await admin
      .from("instagram_post_categories")
      .update({ review_status: "rejected", updated_at: timestamp })
      .eq("post_id", body.postId)
      .neq("category_id", uniqueCategoryIds[0])
      .in("review_status", ["suggested", "confirmed"]);
    if (rejectPreviousError) return jsonError("Não foi possível atualizar as sugestões anteriores.", 500);

    const { data: savedCategory, error: saveCategoriesError } = await admin
      .from("instagram_post_categories")
      .upsert(uniqueCategoryIds.map((categoryId) => ({
        post_id: body.postId,
        category_id: categoryId,
        source: "manual",
        confidence: null,
        review_status: "confirmed",
        updated_at: timestamp,
      })), { onConflict: "post_id,category_id" })
      .select("post_id, category_id, review_status")
      .single();
    if (saveCategoriesError || !savedCategory || savedCategory.review_status !== "confirmed") {
      return jsonError("Não foi possível confirmar a categoria no banco de dados.", 500);
    }

    // Read the persisted state before responding. The client only removes a post
    // from "Sem categoria" after this verification succeeds.
    const { data: confirmedCategories, error: confirmationError } = await admin
      .from("instagram_post_categories")
      .select("category_id")
      .eq("post_id", body.postId)
      .eq("review_status", "confirmed");
    const confirmedCategoryIds = (confirmedCategories ?? []).map((category) => category.category_id);
    if (confirmationError || confirmedCategoryIds.length !== 1 || confirmedCategoryIds[0] !== uniqueCategoryIds[0]) {
      return jsonError("A categoria não pôde ser confirmada no banco de dados. Nenhuma alteração foi considerada concluída.", 500);
    }

    revalidatePath("/divulgacao");
    revalidateDashboardData();
    revalidateInstagramContentSummary();
    return Response.json({
      status: "confirmed",
      categoryCount: uniqueCategoryIds.length,
      postId: body.postId,
      categoryId: uniqueCategoryIds[0],
    }, { headers: { "Cache-Control": "no-store" } });
  }

  const { error } = await admin
    .from("instagram_post_categories")
    .update({ review_status: "rejected", updated_at: new Date().toISOString() })
    .eq("post_id", body.postId)
    .eq("review_status", "suggested");
  if (error) return jsonError("Não foi possível rejeitar as sugestões.", 500);

  revalidatePath("/divulgacao");
  revalidateDashboardData();
  revalidateInstagramContentSummary();
  return Response.json({ status: "rejected" });
}
