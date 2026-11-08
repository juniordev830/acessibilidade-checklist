import { Assessment, Check, Status } from "./report";

export type SortKey = "id" | "titulo" | "status";
export type SortDirection = "asc" | "desc";
export interface FilterOptions {
  status?: Status;
  query?: string;
  sort?: SortKey;
  direction?: SortDirection;
  offset?: number;
  limit?: number;
}
export interface FilterResult {
  total: number;
  offset: number;
  limit: number;
  itens: Check[];
}
export interface AssessmentSummary {
  total: number;
  aprovado: number;
  pendente: number;
  nao_aplicavel: number;
  aplicaveis: number;
  taxaAprovacao: number | null;
  comEvidencia: number;
  semEvidencia: number;
}
export type QualityCode = "EVIDENCIA_AUSENTE" | "TITULO_REPETIDO" | "EVIDENCIA_CURTA";
export interface QualityFinding {
  id: string;
  code: QualityCode;
  severity: "aviso" | "informacao";
  message: string;
}
export interface CategorySummary {
  categoria: string;
  total: number;
  aprovado: number;
  pendente: number;
  nao_aplicavel: number;
}
const validStatuses: readonly Status[] = ["aprovado", "pendente", "nao_aplicavel"];
const collator = new Intl.Collator("pt-BR", { sensitivity: "base", numeric: true });

function normalized(value: string): string {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("pt-BR");
}
function assertInteger(value: number, label: string, min: number, max: number): void {
  if (!Number.isSafeInteger(value) || value < min || value > max) {
    throw new Error(label + " deve estar entre " + min + " e " + max);
  }
}
export function filterChecks(assessment: Assessment, options: FilterOptions = {}): FilterResult {
  const { status, query = "", sort = "id", direction = "asc", offset = 0, limit = 100 } = options;
  assertInteger(offset, "offset", 0, 1000000);
  assertInteger(limit, "limit", 1, 100);
  if (status !== undefined && !validStatuses.includes(status)) throw new Error("status de filtro invalido");
  if (typeof query !== "string" || query.length > 200) throw new Error("consulta invalida");
  if (!["id", "titulo", "status"].includes(sort)) throw new Error("ordenacao invalida");
  if (!["asc", "desc"].includes(direction)) throw new Error("direcao invalida");
  const term = normalized(query.trim());
  const selected = assessment.itens.filter((item) => {
    if (status && item.status !== status) return false;
    if (!term) return true;
    return [item.id, item.titulo, item.evidencia].some((part) => normalized(part).includes(term));
  });
  selected.sort((left, right) => {
    const primary = collator.compare(left[sort], right[sort]);
    const tie = collator.compare(left.id, right.id);
    return (primary || tie) * (direction === "desc" ? -1 : 1);
  });
  return { total: selected.length, offset, limit, itens: selected.slice(offset, offset + limit) };
}
export function summarizeAssessment(assessment: Assessment): AssessmentSummary {
  const counts: AssessmentSummary = {
    total: assessment.itens.length, aprovado: 0, pendente: 0, nao_aplicavel: 0,
    aplicaveis: 0, taxaAprovacao: null, comEvidencia: 0, semEvidencia: 0,
  };
  for (const item of assessment.itens) {
    counts[item.status]++;
    if (item.evidencia.trim()) counts.comEvidencia++;
    else counts.semEvidencia++;
  }
  counts.aplicaveis = counts.aprovado + counts.pendente;
  counts.taxaAprovacao = counts.aplicaveis
    ? Math.round(counts.aprovado * 10000 / counts.aplicaveis) / 100
    : null;
  return counts;
}
export function inspectEvidence(assessment: Assessment): QualityFinding[] {
  const findings: QualityFinding[] = [];
  const titles = new Map<string, string>();
  for (const item of assessment.itens) {
    const evidence = item.evidencia.trim();
    if (!evidence && item.status !== "nao_aplicavel") {
      findings.push({
        id: item.id, code: "EVIDENCIA_AUSENTE", severity: "aviso",
        message: "Informe evidencia para sustentar o resultado da verificacao.",
      });
    } else if (evidence && evidence.length < 12 && item.status !== "nao_aplicavel") {
      findings.push({
        id: item.id, code: "EVIDENCIA_CURTA", severity: "informacao",
        message: "Considere descrever passos e resultado observado na evidencia.",
      });
    }
    const titleKey = normalized(item.titulo.trim());
    const previous = titles.get(titleKey);
    if (previous) {
      findings.push({
        id: item.id, code: "TITULO_REPETIDO", severity: "informacao",
        message: "Titulo semelhante ao item " + previous + "; confira se e duplicado.",
      });
    } else {
      titles.set(titleKey, item.id);
    }
  }
  return findings;
}
export function summarizeCategories(assessment: Assessment): CategorySummary[] {
  const groups = new Map<string, CategorySummary>();
  for (const item of assessment.itens) {
    const separator = item.id.search(/[:/]/);
    const categoria = separator < 0 ? "geral" : item.id.slice(0, separator).trim() || "geral";
    let group = groups.get(categoria);
    if (!group) {
      group = { categoria, total: 0, aprovado: 0, pendente: 0, nao_aplicavel: 0 };
      groups.set(categoria, group);
    }
    group.total++;
    group[item.status]++;
  }
  return [...groups.values()].sort((a, b) => collator.compare(a.categoria, b.categoria));
}
function safeCsvCell(value: string): string {
  const dangerous = /^[\s\u0000-\u001f]*[=+@-]/u.test(value);
  const escaped = (dangerous ? "'" : "") + value;
  return '"' + escaped.replace(/"/g, '""') + '"';
}
export function renderCsv(assessment: Assessment, items: readonly Check[] = assessment.itens): string {
  const rows: string[][] = [
    ["pagina", "data", "id", "titulo", "status", "evidencia"],
    ...items.map((item) => [
      assessment.pagina, assessment.data, item.id, item.titulo, item.status, item.evidencia,
    ]),
  ];
  return rows.map((row) => row.map(safeCsvCell).join(",")).join("\r\n") + "\r\n";
}
export function renderSummaryJson(assessment: Assessment, options: FilterOptions = {}): string {
  const filtered = filterChecks(assessment, options);
  return JSON.stringify({
    pagina: assessment.pagina,
    data: assessment.data,
    resumo: summarizeAssessment(assessment),
    categorias: summarizeCategories(assessment),
    qualidade: inspectEvidence(assessment),
    paginacao: { total: filtered.total, offset: filtered.offset, limit: filtered.limit },
    itens: filtered.itens,
  }, null, 2) + "\n";
}
