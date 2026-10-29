export const contentCategoryDefinitions = [
  { slug: "itens_kit", name: "Itens do kit", keywords: ["kit", "camiseta", "medalha", "sacochila"] },
  { slug: "lotes_inscricoes", name: "Lotes e inscrições", keywords: ["inscricao", "lote", "vagas", "cupom", "virada"] },
  { slug: "percurso", name: "Percurso", keywords: ["percurso", "trajeto", "altimetria", "mapa"] },
  { slug: "publicidade", name: "Publicidade", keywords: ["patrocinador", "parceiro", "apoio", "publicidade", "publi"] },
  { slug: "informacoes", name: "Informações", keywords: ["regulamento", "retirada", "horario", "local", "largada"] },
  { slug: "contagem_regressiva", name: "Contagem regressiva", keywords: [] },
  { slug: "bastidores", name: "Bastidores", keywords: ["bastidores", "montagem", "equipe", "preparativos"] },
  { slug: "produtos_exclusivos", name: "Produtos exclusivos", keywords: ["exclusivo", "colecao", "produto", "loja"] },
  { slug: "dump_aftermovie", name: "Dump & aftermovie", keywords: ["dump", "aftermovie", "melhores momentos", "pos prova", "posprova"] },
  { slug: "outros", name: "Outros", keywords: [] },
] as const;

export type ContentCategorySlug = (typeof contentCategoryDefinitions)[number]["slug"];

export type CategorySuggestion = {
  slug: ContentCategorySlug;
  name: string;
  confidence: number;
  matchedTerms: string[];
  source: "automatic_rules";
};

export type CategorySuggestionInput = {
  caption?: string | null;
  visualDescription?: string | null;
  audioTranscript?: string | null;
};

function normalize(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function hasTerm(text: string, term: string) {
  return ` ${text} `.includes(` ${term} `);
}

function countdownTerms(text: string) {
  const terms: string[] = [];
  if (hasTerm(text, "contagem regressiva")) terms.push("contagem regressiva");
  if (/\bfaltam?\s+\d+\s+dias?\b/.test(text)) terms.push("faltam X dias");
  if (/\b(?:e|é)\s+amanha.*\b(?:etapa|prova|corrida|evento)\b/.test(text)) terms.push("é amanhã a etapa");
  if (/\bamanha.*\b(?:etapa|prova|corrida|evento)\b/.test(text)) terms.push("amanhã é a etapa");
  return terms;
}

export function suggestContentCategories(input: CategorySuggestionInput): CategorySuggestion[] {
  const text = normalize([input.caption, input.visualDescription, input.audioTranscript].filter(Boolean).join(" "));
  const suggestions = contentCategoryDefinitions
    .filter((category) => category.slug !== "outros")
    .map((category) => {
      const matchedTerms = category.slug === "contagem_regressiva"
        ? countdownTerms(text)
        : category.keywords.filter((keyword) => hasTerm(text, keyword));
      const confidence = category.slug === "contagem_regressiva" && matchedTerms.length > 0
        ? 0.93
        : Math.min(0.95, 0.45 + matchedTerms.length * 0.18);
      return { slug: category.slug, name: category.name, confidence, matchedTerms, source: "automatic_rules" as const };
    })
    .filter((category) => category.matchedTerms.length > 0)
    .sort((left, right) => right.confidence - left.confidence || left.name.localeCompare(right.name));

  if (suggestions.length > 0) return suggestions;

  return [{
    slug: "outros",
    name: "Outros",
    confidence: 0.35,
    matchedTerms: [],
    source: "automatic_rules",
  }];
}
