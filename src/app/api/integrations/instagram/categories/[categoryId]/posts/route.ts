import { getApiUserAccess, isAdministrator } from "@/lib/auth/access";
import { getInstagramPostsForCategory } from "@/lib/instagram-data";

export const dynamic = "force-dynamic";

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

function parseOffset(value: string | null) {
  const parsed = Number.parseInt(value ?? "0", 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
}

export async function GET(request: Request, { params }: { params: Promise<{ categoryId: string }> }) {
  const access = await getApiUserAccess();
  if (!access) return Response.json({ error: "Faça login para consultar as categorias." }, { status: 401 });
  if (!isAdministrator(access)) return Response.json({ error: "Somente administradores podem revisar classificações." }, { status: 403 });

  const { categoryId } = await params;
  if (categoryId !== "unclassified" && !isUuid(categoryId)) {
    return Response.json({ error: "A categoria informada não é válida." }, { status: 400 });
  }

  try {
    const data = await getInstagramPostsForCategory(categoryId, parseOffset(new URL(request.url).searchParams.get("offset")));
    return Response.json(data, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return Response.json({ error: "Não foi possível carregar os posts desta categoria." }, { status: 500 });
  }
}
