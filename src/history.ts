import { Assessment, Status } from "./report";
import { compareAssessments, CheckChange, Comparison } from "./compare";
import { AssessmentSummary, summarizeAssessment } from "./analytics";

export interface HistorySnapshot {
  data: string;
  resumo: AssessmentSummary;
  alteracoes: Comparison["resumo"] | null;
}
export interface HistoryItem {
  id: string;
  titulo: string;
  estados: Array<Status | null>;
  primeiraData: string;
  ultimaData: string;
  mudancasDeStatus: number;
}
export interface HistoryRegression {
  id: string;
  titulo: string;
  dataAnterior: string;
  dataAtual: string;
  de: Status;
  para: Status;
}
export interface History {
  pagina: string;
  snapshots: HistorySnapshot[];
  criterios: HistoryItem[];
  regressoes: HistoryRegression[];
  totais: { melhorias: number; regressoes: number; inclusoes: number; remocoes: number };
}
const collator = new Intl.Collator("pt-BR", { sensitivity: "base", numeric: true });

export function buildHistory(assessments: readonly Assessment[]): History {
  if (assessments.length < 2 || assessments.length > 52) {
    throw new Error("historico exige entre 2 e 52 avaliacoes");
  }
  const pagina = assessments[0].pagina;
  for (let index = 0; index < assessments.length; index++) {
    const assessment = assessments[index];
    if (assessment.pagina !== pagina) {
      throw new Error("historico exige a mesma pagina");
    }
    if (index > 0 && assessment.data <= assessments[index - 1].data) {
      throw new Error("datas do historico devem ser estritamente crescentes");
    }
  }
  const snapshots: HistorySnapshot[] = [];
  const regressions: HistoryRegression[] = [];
  const totals = { melhorias: 0, regressoes: 0, inclusoes: 0, remocoes: 0 };
  for (let index = 0; index < assessments.length; index++) {
    const current = assessments[index];
    let changes: Comparison["resumo"] | null = null;
    if (index > 0) {
      const previous = assessments[index - 1];
      const comparison = compareAssessments(previous, current);
      changes = comparison.resumo;
      totals.melhorias += changes.melhorou;
      totals.regressoes += changes.regrediu;
      totals.inclusoes += changes.novo;
      totals.remocoes += changes.removido;
      for (const change of comparison.alteracoes) {
        if (change.tipo === "regrediu") {
          regressions.push({
            id: change.id, titulo: change.titulo,
            dataAnterior: previous.data, dataAtual: current.data,
            de: change.antes!, para: change.depois!,
          });
        }
      }
    }
    snapshots.push({
      data: current.data, resumo: summarizeAssessment(current), alteracoes: changes,
    });
  }
  const ids = new Set(assessments.flatMap((a) => a.itens.map((item) => item.id)));
  const criterios: HistoryItem[] = [...ids].sort(collator.compare).map((id) => {
    const entries = assessments.map((assessment) => assessment.itens.find((item) => item.id === id));
    const indexes = entries.flatMap((entry, index) => entry ? [index] : []);
    const last = entries[indexes[indexes.length - 1]]!;
    let changes = 0;
    for (let index = 1; index < entries.length; index++) {
      if (entries[index - 1] && entries[index] &&
          entries[index - 1]!.status !== entries[index]!.status) changes++;
    }
    return {
      id, titulo: last.titulo,
      estados: entries.map((entry) => entry?.status ?? null),
      primeiraData: assessments[indexes[0]].data,
      ultimaData: assessments[indexes[indexes.length - 1]].data,
      mudancasDeStatus: changes,
    };
  });
  return { pagina, snapshots, criterios, regressoes: regressions, totais: totals };
}
function md(value: string): string {
  return value.replace(/\\/g, "\\\\")
    .replace(/([*_{}\[\]()#+.!|<>~-])/g, "\\$1")
    .replaceAll("`", "\\`")
    .replace(/\r\n|\r|\n/g, " ↵ ");
}
export function renderHistoryMarkdown(history: History): string {
  const lines = [
    "# Historico de verificacoes de acessibilidade", "",
    "**Pagina:** " + md(history.pagina),
    "**Avaliacoes:** " + history.snapshots.length, "",
    "| Data | Aprovados | Pendentes | N/A | Taxa aplicavel | Melhorias | Regressoes |",
    "| --- | ---: | ---: | ---: | ---: | ---: | ---: |",
  ];
  for (const snapshot of history.snapshots) {
    const s = snapshot.resumo;
    const percentage = s.taxaAprovacao === null ? "N/A" : s.taxaAprovacao.toFixed(2) + "%";
    lines.push("| " + snapshot.data + " | " + s.aprovado + " | " + s.pendente +
      " | " + s.nao_aplicavel + " | " + percentage +
      " | " + (snapshot.alteracoes?.melhorou ?? "—") +
      " | " + (snapshot.alteracoes?.regrediu ?? "—") + " |");
  }
  lines.push("", "## Trajetoria por criterio", "");
  for (const item of history.criterios) {
    lines.push("- **" + md(item.id) + "** (" + md(item.titulo) + "): " +
      item.estados.map((state) => state ?? "ausente").join(" → "));
  }
  lines.push("", "## Regressoes observadas", "");
  if (!history.regressoes.length) lines.push("Nenhuma regressao de status registrada.");
  for (const regression of history.regressoes) {
    lines.push("- " + md(regression.id) + ": " + regression.de + " → " +
      regression.para + " (" + regression.dataAnterior + " a " + regression.dataAtual + ")");
  }
  lines.push("", "> Historico de verificacoes manuais; nao certifica conformidade WCAG.", "");
  return lines.join("\n");
}
