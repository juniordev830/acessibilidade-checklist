import { Assessment, Check, Status, validateAssessment } from "./report";
import { summarizeCategories } from "./analytics";

export interface RemediationTask {
  id: string;
  titulo: string;
  categoria: string;
  evidencia: string;
  evidenciaAusente: boolean;
  proximoPasso: string;
  verificacao: string;
}
export interface RemediationPlan {
  pagina: string;
  data: string;
  totalPendentes: number;
  comEvidencia: number;
  semEvidencia: number;
  tarefas: RemediationTask[];
}
export interface ReviewChange {
  id: string;
  status: Status;
  evidencia: string;
  titulo?: string;
}
const collator = new Intl.Collator("pt-BR", { sensitivity: "base", numeric: true });
function category(id: string): string {
  const separator = id.search(/[:/]/);
  return separator < 0 ? "geral" : id.slice(0, separator).trim() || "geral";
}
export function buildRemediationPlan(assessment: Assessment): RemediationPlan {
  const pending = assessment.itens.filter((item) => item.status === "pendente");
  const tasks: RemediationTask[] = pending.map((item) => {
    const missing = !item.evidencia.trim();
    return {
      id: item.id, titulo: item.titulo, categoria: category(item.id),
      evidencia: item.evidencia, evidenciaAusente: missing,
      proximoPasso: missing
        ? "Reproduzir a verificacao e documentar o problema antes de propor correcao."
        : "Analisar a evidencia, corrigir o problema e registrar a alteracao realizada.",
      verificacao: "Reexecutar manualmente a verificacao e registrar resultado e evidencia.",
    };
  });
  tasks.sort((a, b) => {
    const priority = Number(b.evidenciaAusente) - Number(a.evidenciaAusente);
    return priority || collator.compare(a.categoria, b.categoria) || collator.compare(a.id, b.id);
  });
  return {
    pagina: assessment.pagina, data: assessment.data,
    totalPendentes: pending.length,
    comEvidencia: pending.filter((item) => item.evidencia.trim()).length,
    semEvidencia: pending.filter((item) => !item.evidencia.trim()).length,
    tarefas: tasks,
  };
}
function md(value: string): string {
  return value.replace(/\\/g, "\\\\")
    .replace(/([*_{}\[\]()#+.!|<>~-])/g, "\\$1")
    .replaceAll("`", "\\`")
    .replace(/\r\n|\r|\n/g, " ↵ ");
}
export function renderRemediationMarkdown(plan: RemediationPlan): string {
  const lines = [
    "# Plano de correcoes de acessibilidade", "",
    "**Pagina:** " + md(plan.pagina),
    "**Avaliacao:** " + plan.data,
    "**Pendentes:** " + plan.totalPendentes + " (" +
      plan.comEvidencia + " com evidencia; " + plan.semEvidencia + " sem evidencia)", "",
    "> A ordem prioriza a coleta de evidencias ausentes; nao representa severidade WCAG.", "",
  ];
  if (!plan.tarefas.length) lines.push("Nenhum item pendente nesta avaliacao.", "");
  for (const task of plan.tarefas) {
    lines.push("## " + md(task.id) + " — " + md(task.titulo), "");
    lines.push("- [ ] " + md(task.proximoPasso));
    lines.push("- [ ] " + md(task.verificacao));
    lines.push("- **Categoria:** " + md(task.categoria));
    lines.push("- **Evidencia registrada:** " +
      (task.evidencia.trim() ? md(task.evidencia) : "(nao informada)"));
    lines.push("");
  }
  return lines.join("\n");
}
export function applyReview(
  assessment: Assessment, newDate: string, changes: readonly ReviewChange[],
): Assessment {
  if (!Array.isArray(changes) || changes.length < 1 || changes.length > 100) {
    throw new Error("revisao exige entre 1 e 100 alteracoes");
  }
  if (newDate < assessment.data) throw new Error("data da revisao nao pode retroceder");
  const existing = new Map(assessment.itens.map((item) => [item.id, item]));
  const updates = new Map<string, ReviewChange>();
  for (const change of changes) {
    if (!change || typeof change.id !== "string" || !existing.has(change.id)) {
      throw new Error("id de revisao desconhecido");
    }
    if (updates.has(change.id)) throw new Error("id de revisao duplicado: " + change.id);
    if (!["aprovado", "pendente", "nao_aplicavel"].includes(change.status)) {
      throw new Error("status de revisao invalido");
    }
    if (typeof change.evidencia !== "string" ||
        (change.status !== "nao_aplicavel" && !change.evidencia.trim())) {
      throw new Error("revisao exige evidencia para criterios aplicaveis");
    }
    updates.set(change.id, change);
  }
  const itens: Check[] = assessment.itens.map((item) => {
    const update = updates.get(item.id);
    if (!update) return { ...item };
    return {
      id: item.id, titulo: update.titulo ?? item.titulo,
      status: update.status, evidencia: update.evidencia,
    };
  });
  return validateAssessment({ pagina: assessment.pagina, data: newDate, itens });
}
export function pendingByCategory(assessment: Assessment): Array<{ categoria: string; pendentes: number }> {
  return summarizeCategories(assessment)
    .filter((group) => group.pendente > 0)
    .map((group) => ({ categoria: group.categoria, pendentes: group.pendente }));
}
