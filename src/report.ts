export type Status = "aprovado" | "pendente" | "nao_aplicavel";

export interface Check {
  id: string;
  titulo: string;
  status: Status;
  evidencia: string;
}

export interface Assessment {
  pagina: string;
  data: string;
  itens: Check[];
}

const statuses: readonly Status[] = ["aprovado", "pendente", "nao_aplicavel"];

function record(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function requiredText(value: unknown, label: string, max = 500): string {
  if (typeof value !== "string" || !value.trim() || value.length > max) {
    throw new Error(label + ": texto obrigatorio, ate " + max + " caracteres");
  }
  return value.trim();
}

export function validateAssessment(value: unknown): Assessment {
  if (!record(value)) throw new Error("Avaliacao deve ser um objeto");
  const pagina = requiredText(value.pagina, "pagina", 400);
  const data = requiredText(value.data, "data", 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(data) ||
      !Number.isFinite(Date.parse(data)) ||
      new Date(data + "T00:00:00Z").toISOString().slice(0, 10) !== data) {
    throw new Error("data deve ser uma data ISO valida (AAAA-MM-DD)");
  }
  if (!Array.isArray(value.itens) || value.itens.length < 1 || value.itens.length > 100) {
    throw new Error("itens deve ser uma lista de 1 a 100 verificacoes");
  }
  const ids = new Set<string>();
  const itens: Check[] = value.itens.map((entry: unknown, index: number) => {
    if (!record(entry)) throw new Error("item " + (index + 1) + ": objeto esperado");
    const id = requiredText(entry.id, "id", 80);
    if (ids.has(id)) throw new Error("id duplicado: " + id);
    ids.add(id);
    const titulo = requiredText(entry.titulo, "titulo", 240);
    if (!statuses.includes(entry.status as Status)) throw new Error("status invalido no item " + id);
    if (typeof entry.evidencia !== "string" || entry.evidencia.length > 4000) {
      throw new Error("evidencia invalida no item " + id);
    }
    return { id, titulo, status: entry.status as Status, evidencia: entry.evidencia };
  });
  return { pagina, data, itens };
}

function escapeMarkdown(value: string): string {
  return value.replace(/\\/g, "\\\\")
    .replace(/([*_{}\[\]()#+.!|<>~-])/g, "\\$1")
    .replaceAll(String.fromCharCode(96), "\\" + String.fromCharCode(96))
    .replace(/\r\n|\r|\n/g, " ↵ ");
}

const labels: Record<Status, string> = {
  aprovado: "Aprovado",
  pendente: "Pendente",
  nao_aplicavel: "Nao aplicavel",
};

export function renderMarkdown(assessment: Assessment): string {
  const counts = { aprovado: 0, pendente: 0, nao_aplicavel: 0 };
  for (const check of assessment.itens) counts[check.status]++;
  const lines = [
    "# Checklist de acessibilidade", "",
    "**Pagina:** " + escapeMarkdown(assessment.pagina),
    "**Data:** " + assessment.data, "",
    "**Resumo:** " + counts.aprovado + " aprovados, " + counts.pendente +
      " pendentes, " + counts.nao_aplicavel + " nao aplicaveis.", "",
    "> Este checklist apoia revisoes manuais; nao e certificacao de acessibilidade.", "",
  ];
  for (const check of assessment.itens) {
    lines.push("## " + escapeMarkdown(check.id) + " — " + escapeMarkdown(check.titulo));
    lines.push("");
    lines.push("**Status:** " + labels[check.status]);
    lines.push("**Evidencia:** " + (check.evidencia.trim() ? escapeMarkdown(check.evidencia) : "(nao informada)"));
    lines.push("");
  }
  return lines.join("\n");
}
