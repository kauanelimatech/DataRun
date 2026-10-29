import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

type ReviewAction = "confirm" | "reject" | "recategorize";

function jsonError(message: string, status: number) {
  return Response.json({ error: message }, { status });
}

function isUuid(value: unknown): value is string {
  return typeof value === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

export async function PATCH(request: Request) {
  const supabase = await createClient();
  const { data: claims, error: authError } = await supabase.auth.getClaims();
  if (authError || typeof claims?.claims?.sub !== "string") {
    return jsonError("Faça login para revisar as categorias.", 401);
  }

  const body = await request.json().catch(() => null) as {
    postId?: unknown;
    categoryId?: unknown;
    action?: unknown;
    replacementCategoryId?: unknown;
  } | null;

  const action = body?.action;
  if (!isUuid(body?.postId) || !isUuid(body?.categoryId) || !["confirm", "reject", "recategorize"].includes(String(action))) {
    return jsonError("A revisão enviada não é válida.", 400);
  }

  const admin = createAdminClient();
  if (action === "recategorize") {
    if (!isUuid(body?.replacementCategoryId)) return jsonError("Selecione a categoria correta para o post.", 400);

    if (body.replacementCategoryId === body.categoryId) {
      const { error } = await admin
        .from("instagram_post_categories")
        .update({ review_status: "confirmed", updated_at: new Date().toISOString() })
        .eq("post_id", body.postId)
        .eq("category_id", body.categoryId);
      if (error) return jsonError("Não foi possível confirmar a categoria.", 500);
      return Response.json({ status: "confirmed" });
    }

    const { data: category, error: categoryError } = await admin
      .from("content_categories")
      .select("id")
      .eq("id", body.replacementCategoryId)
      .eq("is_active", true)
      .maybeSingle();
    if (categoryError || !category) return jsonError("A categoria escolhida não está disponível.", 400);

    const { error: saveReplacementError } = await admin
      .from("instagram_post_categories")
      .upsert({
        post_id: body.postId,
        category_id: body.replacementCategoryId,
        source: "manual",
        confidence: null,
        review_status: "confirmed",
        updated_at: new Date().toISOString(),
      }, { onConflict: "post_id,category_id" });
    if (saveReplacementError) return jsonError("Não foi possível salvar a categoria escolhida.", 500);

    const { error: rejectPreviousError } = await admin
      .from("instagram_post_categories")
      .update({ review_status: "rejected", updated_at: new Date().toISOString() })
      .eq("post_id", body.postId)
      .eq("category_id", body.categoryId);
    if (rejectPreviousError) return jsonError("A nova categoria foi salva, mas não foi possível encerrar a sugestão anterior.", 500);

    return Response.json({ status: "recategorized" });
  }

  const reviewStatus = action === "confirm" ? "confirmed" : "rejected";
  const { error } = await admin
    .from("instagram_post_categories")
    .update({ review_status: reviewStatus, updated_at: new Date().toISOString() })
    .eq("post_id", body.postId)
    .eq("category_id", body.categoryId);
  if (error) return jsonError("Não foi possível registrar a revisão.", 500);

  return Response.json({ status: reviewStatus });
}
