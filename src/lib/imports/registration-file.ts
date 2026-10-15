import * as XLSX from "xlsx";

const REQUIRED_HEADERS = [
  "ano",
  "etapa_origem",
  "id_inscricao",
  "data_inscricao",
  "valor_final",
  "situacao_inscricao",
  "situacao_compra",
] as const;

export type ImportIssue = {
  row: number;
  field: string;
  message: string;
};

export type ParsedRegistration = {
  sourceRowNumber: number;
  sourceYear: number;
  sourceStage: string;
  externalRegistrationId: string;
  externalPurchaseId: string | null;
  lotName: string | null;
  kitName: string | null;
  listPrice: number | null;
  registeredOn: string;
  isCredentialed: boolean;
  credentialedAt: string | null;
  discountCoupon: string | null;
  discountAmount: number;
  finalAmount: number;
  registrationStatus: string;
  purchaseStatus: string;
  marketingOptIn: boolean;
  sourceUpdatedOn: string | null;
  city: string | null;
  ageRange: string | null;
  discountType: string | null;
  routeName: string | null;
  shirtSize: string | null;
  kitPickupLocation: string | null;
  termsAccepted: boolean;
  participationProfile: string | null;
  participationReason: string | null;
  favoriteEventFeature: string | null;
  affiliateCode: string | null;
  utmSource: string | null;
  utmMedium: string | null;
  utmCampaign: string | null;
};

export type RegistrationFileParseResult = {
  records: ParsedRegistration[];
  sourceRecordCount: number;
  worksheetName: string;
  warnings: string[];
};

export class RegistrationFileValidationError extends Error {
  readonly issues: ImportIssue[];

  constructor(
    message: string,
    issues: ImportIssue[] = [],
  ) {
    super(message);
    this.name = "RegistrationFileValidationError";
    this.issues = issues;
  }
}

const FIELD_ALIASES: Record<string, string> = {
  ano: "ano",
  etapa_origem: "etapa_origem",
  id_inscricao: "id_inscricao",
  id_compra: "id_compra",
  lote: "lote",
  kit: "kit",
  valor: "valor",
  data_inscricao: "data_inscricao",
  credenciado: "credenciado",
  data_hora_credenciamento: "data_hora_credenciamento",
  cupom_desconto: "cupom_desconto",
  valor_cupom_desconto: "valor_cupom_desconto",
  valor_final: "valor_final",
  situacao_inscricao: "situacao_inscricao",
  situacao_compra: "situacao_compra",
  receber_emails_evento: "receber_emails_evento",
  outras_informacoes: "outras_informacoes",
  ultima_atualizacao: "ultima_atualizacao",
  cidade: "cidade",
  data_nascimento: "data_nascimento",
  tipo_desconto: "tipo_desconto",
  percurso: "percurso",
  tamanho_camiseta: "tamanho_camiseta",
  local_retirada_kit: "local_retirada_kit",
  regulamento_aceito: "regulamento_aceito",
  participacao: "participacao",
  motivo_participacao: "motivo_participacao",
  o_que_gosta_enm_1: "o_que_gosta_enm_1",
  o_que_gosta_em_1: "o_que_gosta_enm_1",
  codigo_afiliado: "codigo_afiliado",
  utm_source: "utm_source",
  utm_medium: "utm_medium",
  utm_campaign: "utm_campaign",
};

// Fields that are useful to the dashboard and do not directly identify a participant.
// Every source column outside this list is ignored, never preserved as raw payload.
const ALLOWED_SOURCE_HEADERS = new Set([
  "ano", "etapa_origem", "id_inscricao", "id_compra", "lote", "kit", "valor",
  "data_inscricao", "credenciado", "data_hora_credenciamento", "cupom_desconto",
  "valor_cupom_desconto", "valor_final", "situacao_inscricao", "situacao_compra",
  "receber_emails_evento", "ultima_atualizacao", "cidade", "data_nascimento", "tipo_desconto", "percurso",
  "tamanho_camiseta", "local_retirada_kit", "regulamento_aceito", "participacao",
  "motivo_participacao", "o_que_gosta_enm_1", "codigo_afiliado", "utm_source",
  "utm_medium", "utm_campaign",
]);

function normalizeHeader(value: unknown) {
  return String(value ?? "")
    .trim()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function text(value: unknown) {
  if (value === null || value === undefined) return null;
  if (value instanceof Date) return value.toISOString();
  const normalized = String(value).trim();
  return normalized === "" ? null : normalized;
}

function formatDate(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function formatTimestamp(date: Date) {
  const datePart = formatDate(date);
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");
  const seconds = String(date.getSeconds()).padStart(2, "0");
  return `${datePart} ${hours}:${minutes}:${seconds}`;
}

function dateFromExcelSerial(value: number) {
  const parsed = XLSX.SSF.parse_date_code(value);
  if (!parsed) return null;
  return new Date(parsed.y, parsed.m - 1, parsed.d, parsed.H, parsed.M, parsed.S);
}

function parseDate(value: unknown, includeTime = false): string | null {
  if (value === null || value === undefined || value === "") return null;

  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return includeTime ? formatTimestamp(value) : formatDate(value);
  }

  if (typeof value === "number") {
    const date = dateFromExcelSerial(value);
    return date ? (includeTime ? formatTimestamp(date) : formatDate(date)) : null;
  }

  const normalized = text(value);
  if (!normalized) return null;
  const match = normalized.match(/^(\d{2})\/(\d{2})\/(\d{4})(?:\s+(\d{1,2}):(\d{2})(?::(\d{2}))?)?$/);

  if (match) {
    const [, day, month, year, hour = "0", minute = "0", second = "0"] = match;
    const date = new Date(Number(year), Number(month) - 1, Number(day), Number(hour), Number(minute), Number(second));
    if (date.getFullYear() !== Number(year) || date.getMonth() !== Number(month) - 1 || date.getDate() !== Number(day)) return null;
    return includeTime ? formatTimestamp(date) : formatDate(date);
  }

  const isoMatch = normalized.match(/^(\d{4})-(\d{2})-(\d{2})(?:[ T](\d{2}):(\d{2})(?::(\d{2}))?)?$/);
  if (!isoMatch) return null;
  const [, year, month, day, hour = "0", minute = "0", second = "0"] = isoMatch;
  const date = new Date(Number(year), Number(month) - 1, Number(day), Number(hour), Number(minute), Number(second));
  if (date.getFullYear() !== Number(year) || date.getMonth() !== Number(month) - 1 || date.getDate() !== Number(day)) return null;
  return includeTime ? formatTimestamp(date) : formatDate(date);
}

function parseMoney(value: unknown) {
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  const raw = text(value);
  if (!raw) return null;
  const cleaned = raw.replace(/R\$/gi, "").replace(/\s/g, "");
  const comma = cleaned.lastIndexOf(",");
  const dot = cleaned.lastIndexOf(".");
  const normalized = comma > dot
    ? cleaned.replace(/\./g, "").replace(",", ".")
    : cleaned.replace(/,/g, "");
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

function parseBoolean(value: unknown) {
  if (typeof value === "boolean") return value;
  if (typeof value === "number") return value !== 0;
  const normalized = normalizeHeader(value);
  if (["sim", "s", "true", "1", "yes"].includes(normalized)) return true;
  if (["nao", "n", "false", "0", "no"].includes(normalized)) return false;
  return false;
}

function parseId(value: unknown) {
  const raw = text(value);
  if (!raw || !/^\d+(?:\.0+)?$/.test(raw)) return null;
  const id = raw.replace(/\.0+$/, "");
  try {
    return BigInt(id) > BigInt(0) ? id : null;
  } catch {
    return null;
  }
}

function ageRangeFromBirthDate(birthDate: string | null, referenceDate: string) {
  if (!birthDate) return null;
  const [birthYear, birthMonth, birthDay] = birthDate.split("-").map(Number);
  const [referenceYear, referenceMonth, referenceDay] = referenceDate.split("-").map(Number);
  if (![birthYear, birthMonth, birthDay, referenceYear, referenceMonth, referenceDay].every(Number.isFinite)) return null;

  let age = referenceYear - birthYear;
  if (referenceMonth < birthMonth || (referenceMonth === birthMonth && referenceDay < birthDay)) age -= 1;
  if (age < 0 || age > 120) return null;
  const lowerLimit = Math.floor(age / 5) * 5;
  return `${lowerLimit}-${lowerLimit + 4}`;
}

function isRowEmpty(values: unknown[]) {
  return values.every((value) => value === null || value === undefined || String(value).trim() === "");
}

function getFirstDataSheet(workbook: XLSX.WorkBook) {
  for (const name of workbook.SheetNames) {
    const worksheet = workbook.Sheets[name];
    if (!worksheet) continue;
    const rows = XLSX.utils.sheet_to_json<unknown[]>(worksheet, { header: 1, defval: null, raw: true, blankrows: false });
    if (rows.some((row) => !isRowEmpty(row))) return { name, rows };
  }
  return null;
}

function cell(row: Record<string, unknown>, field: string) {
  return row[field];
}

export function parseRegistrationFile(buffer: Buffer): RegistrationFileParseResult {
  let workbook: XLSX.WorkBook;
  try {
    workbook = XLSX.read(buffer, { type: "buffer", cellDates: true, raw: true });
  } catch {
    throw new RegistrationFileValidationError("Não foi possível ler este arquivo. Envie uma planilha válida em CSV, XLS, XLSX ou Numbers.");
  }

  const sheet = getFirstDataSheet(workbook);
  if (!sheet) throw new RegistrationFileValidationError("A planilha não contém dados para importar.");

  const [headerRow, ...dataRows] = sheet.rows;
  const headers = headerRow.map((header, index) => {
    const normalized = normalizeHeader(header) || `coluna_${index + 1}`;
    return FIELD_ALIASES[normalized] ?? normalized;
  });
  const missingHeaders = REQUIRED_HEADERS.filter((header) => !headers.includes(header));
  if (missingHeaders.length > 0) {
    throw new RegistrationFileValidationError(`Colunas obrigatórias ausentes: ${missingHeaders.join(", ")}.`, missingHeaders.map((field) => ({ row: 1, field, message: "Coluna obrigatória não encontrada." })));
  }

  const ignoredHeaders = headers.filter((header) => !ALLOWED_SOURCE_HEADERS.has(header));
  const issues: ImportIssue[] = [];
  const records: ParsedRegistration[] = [];
  let sourceRecordCount = 0;

  dataRows.forEach((values, index) => {
    if (isRowEmpty(values)) return;
    sourceRecordCount += 1;
    const rowNumber = index + 2;
    const row: Record<string, unknown> = {};

    headers.forEach((header, columnIndex) => {
      const value = values[columnIndex];
      if (row[header] === undefined) row[header] = value;
    });

    const sourceYear = Number(text(cell(row, "ano")));
    const sourceStage = text(cell(row, "etapa_origem"));
    const externalRegistrationId = parseId(cell(row, "id_inscricao"));
    const registeredOn = parseDate(cell(row, "data_inscricao"));
    const finalAmount = parseMoney(cell(row, "valor_final"));
    const registrationStatus = text(cell(row, "situacao_inscricao"));
    const purchaseStatus = text(cell(row, "situacao_compra"));
    const rowIssues: ImportIssue[] = [];

    if (!Number.isInteger(sourceYear) || sourceYear < 2000 || sourceYear > 2100) rowIssues.push({ row: rowNumber, field: "ano", message: "Informe um ano entre 2000 e 2100." });
    if (!sourceStage) rowIssues.push({ row: rowNumber, field: "etapa_origem", message: "Informe a etapa de origem." });
    if (!externalRegistrationId) rowIssues.push({ row: rowNumber, field: "id_inscricao", message: "Informe um identificador de inscrição numérico positivo." });
    if (!registeredOn) rowIssues.push({ row: rowNumber, field: "data_inscricao", message: "Use uma data válida, como 14/10/2026." });
    if (finalAmount === null || finalAmount < 0) rowIssues.push({ row: rowNumber, field: "valor_final", message: "Informe um valor final igual ou maior que zero." });
    if (!registrationStatus) rowIssues.push({ row: rowNumber, field: "situacao_inscricao", message: "Informe a situação da inscrição." });
    if (!purchaseStatus) rowIssues.push({ row: rowNumber, field: "situacao_compra", message: "Informe a situação da compra." });

    if (rowIssues.length > 0) {
      issues.push(...rowIssues);
      return;
    }

    const listPrice = parseMoney(cell(row, "valor"));
    const discountAmount = parseMoney(cell(row, "valor_cupom_desconto")) ?? 0;
    const credentialedAtValue = cell(row, "data_hora_credenciamento");
    const credentialedAt = parseDate(credentialedAtValue, true);
    const ageRange = ageRangeFromBirthDate(parseDate(cell(row, "data_nascimento")), registeredOn!);
    if (credentialedAtValue && !credentialedAt) issues.push({ row: rowNumber, field: "data_hora_credenciamento", message: "Use data e hora válidas, como 14/10/2026 08:30." });

    records.push({
      sourceRowNumber: rowNumber,
      sourceYear,
      sourceStage: sourceStage!,
      externalRegistrationId: externalRegistrationId!,
      externalPurchaseId: parseId(cell(row, "id_compra")),
      lotName: text(cell(row, "lote")),
      kitName: text(cell(row, "kit")),
      listPrice: listPrice !== null && listPrice >= 0 ? listPrice : null,
      registeredOn: registeredOn!,
      isCredentialed: parseBoolean(cell(row, "credenciado")),
      credentialedAt,
      discountCoupon: text(cell(row, "cupom_desconto")),
      discountAmount: discountAmount >= 0 ? discountAmount : 0,
      finalAmount: finalAmount!,
      registrationStatus: registrationStatus!,
      purchaseStatus: purchaseStatus!,
      marketingOptIn: parseBoolean(cell(row, "receber_emails_evento")),
      sourceUpdatedOn: parseDate(cell(row, "ultima_atualizacao")),
      city: text(cell(row, "cidade")),
      ageRange,
      discountType: text(cell(row, "tipo_desconto")),
      routeName: text(cell(row, "percurso")),
      shirtSize: text(cell(row, "tamanho_camiseta")),
      kitPickupLocation: text(cell(row, "local_retirada_kit")),
      termsAccepted: parseBoolean(cell(row, "regulamento_aceito")),
      participationProfile: text(cell(row, "participacao")),
      participationReason: text(cell(row, "motivo_participacao")),
      favoriteEventFeature: text(cell(row, "o_que_gosta_enm_1")),
      affiliateCode: text(cell(row, "codigo_afiliado")),
      utmSource: text(cell(row, "utm_source")),
      utmMedium: text(cell(row, "utm_medium")),
      utmCampaign: text(cell(row, "utm_campaign")),
    });
  });

  if (issues.length > 0) {
    throw new RegistrationFileValidationError("Existem dados inválidos na planilha. Corrija-os antes de importar.", issues.slice(0, 50));
  }
  if (records.length === 0) throw new RegistrationFileValidationError("A planilha não contém linhas de inscrição válidas.");

  const warnings = ignoredHeaders.length > 0
    ? [`${ignoredHeaders.length} coluna(s), incluindo campos que possam identificar participantes, foi(ram) ignorada(s) e não será(ão) salva(s).`]
    : [];

  return { records, sourceRecordCount, worksheetName: sheet.name, warnings };
}
