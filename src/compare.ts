import { Assessment, Check, Status } from "./report";

export type ChangeKind = "novo" | "removido" | "melhorou" | "regrediu" | "aplicabilidade" | "inalterado";
export interface CheckChange {
  id: string;
  titulo: string;
  antes: Status | null;
  depois: Status | null;
  tipo: ChangeKind;
  evidenciaAlterada: boolean;
  tituloAlterado: boolean;
}
export interface Comparison {
  pagina: string;
  dataAnterior: string;
  dataAtual: string;
  resumo: Record<ChangeKind, number>;
  alteracoes: CheckChange[];
}
const collator = new Intl.Collator("pt-BR", { sensitivity: "base", numeric: true });
const emptyCounts = (): Record<ChangeKind, number> => ({
  novo: 0, removido: 0, melhorou: 0, regrediu: 0, aplicabilidade: 0, inalterado: 0,
});
function kind(before: Status | null, after: Status | null): ChangeKind {
  if (before === null) return "novo";
  if (after === null) return "removido";
  if (before === after) return "inalterado";
  if (before === "nao_aplicavel" || after === "nao_aplicavel") return "aplicabilidade";
  return before === "pendente" && after === "aprovado" ? "melhorou" : "regrediu";
}
export function compareAssessments(previous: Assessment, current: Assessment): Comparison {
  if (previous.pagina !== current.pagina) {
    throw new Error("comparacao exige a mesma pagina nas duas avaliacoes");
  }
  if (previous.data > current.data) {
    throw new Error("data atual nao pode anteceder a avaliacao anterior");
  }
  const before = new Map(previous.itens.map((item) => [item.id, item]));
  const after = new Map(current.itens.map((item) => [item.id, item]));
  const ids = [...new Set([...before.keys(), ...after.keys()])].sort(collator.compare);
  const resumo = emptyCounts();
  const alteracoes: CheckChange[] = ids.map((id) => {
    const a: Check | undefined = before.get(id);
    const b: Check | undefined = after.get(id);
    const tipo = kind(a?.status ?? null, b?.status ?? null);
    resumo[tipo]++;
    return {
      id, titulo: b?.titulo ?? a!.titulo,
      antes: a?.status ?? null, depois: b?.status ?? null, tipo,
      evidenciaAlterada: Boolean(a && b && a.evidencia !== b.evidencia),
      tituloAlterado: Boolean(a && b && a.titulo !== b.titulo),
    };
  });
  return {
    pagina: current.pagina, dataAnterior: previous.data, dataAtual: current.data,
    resumo, alteracoes,
  };
}
function md(value: string): string {
  return value.replace(/\\/g, "\\\\")
    .replace(/([*_{}\[\]()#+.!|<>~-])/g, "\\$1")
    .replaceAll("`", "\\`")
    .replace(/\r\n|\r|\n/g, " ↵ ");
}
const names: Record<ChangeKind, string> = {
  novo: "Novo", removido: "Removido", melhorou: "Melhorou",
  regrediu: "Regrediu", aplicabilidade: "Aplicabilidade alterada",
  inalterado: "Inalterado",
};
export function renderComparisonMarkdown(comparison: Comparison): string {
  const s = comparison.resumo;
  const lines = [
    "# Evolucao do checklist de acessibilidade", "",
    "**Pagina:** " + md(comparison.pagina),
    "**Periodo:** " + comparison.dataAnterior + " ate " + comparison.dataAtual, "",
    "**Mudancas:** " + s.melhorou + " melhorias, " + s.regrediu +
      " regressoes, " + s.novo + " novos, " + s.removido + " removidos, " +
      s.aplicabilidade + " alteracoes de aplicabilidade, " + s.inalterado + " inalterados.", "",
    "> Comparacao de verificacoes manuais, nao certificacao WCAG.", "",
    "| ID | Criterio | Antes | Depois | Mudanca | Evidencia alterada |", 
    "| --- | --- | --- | --- | --- | --- |",
  ];
  for (const item of comparison.alteracoes) {
    lines.push("| " + md(item.id) + " | " + md(item.titulo) +
      " | " + (item.antes ?? "—") + " | " + (item.depois ?? "—") +
      " | " + names[item.tipo] + " | " + (item.evidenciaAlterada ? "Sim" : "Nao") + " |");
  }
  return lines.join("\n") + "\n";
}
