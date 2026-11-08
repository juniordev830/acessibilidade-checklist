import { renderMarkdown, validateAssessment, Status } from "./report";
import { FilterOptions, filterChecks, renderCsv, renderSummaryJson } from "./analytics";
import { compareAssessments, renderComparisonMarkdown } from "./compare";
import { buildHistory, renderHistoryMarkdown } from "./history";
import { buildRemediationPlan, renderRemediationMarkdown } from "./remediation";

declare const require: (name: string) => any;
declare const process: {
  argv: string[];
  stdout: { write(value: string): void };
  stderr: { write(value: string): void };
  exitCode: number;
};
const fs = require("node:fs");
const MAX_INPUT_BYTES = 1_000_000;

function parseInteger(value: string, name: string): number {
  if (!/^(0|[1-9][0-9]*)$/.test(value)) throw new Error(name + " deve ser inteiro nao negativo");
  const number = Number(value);
  if (!Number.isSafeInteger(number)) throw new Error(name + " fora do intervalo seguro");
  return number;
}
function readAssessment(path: string) {
  // Reject oversized inputs before allocating/parsing the entire document.
  const metadata = fs.statSync(path);
  if (!metadata.isFile()) throw new Error("arquivo de avaliacao deve ser regular");
  if (metadata.size > MAX_INPUT_BYTES) throw new Error("arquivo excede limite de 1 MB");
  const data = fs.readFileSync(path);
  // Recheck after read in case a writer changed the file between operations.
  if (data.length > MAX_INPUT_BYTES) throw new Error("arquivo excede limite de 1 MB");
  return validateAssessment(JSON.parse(data.toString("utf8")) as unknown);
}
function main(): void {
  const args = process.argv.slice(2);
  if (args.length === 0 || args[0].startsWith("--")) {
    throw new Error("Uso: node dist/cli.js arquivo.json [--format=markdown|csv|json|plan] [--status=pendente] [--query=texto] [--sort=id|titulo|status] [--offset=0] [--limit=100] [--compare=anterior.json]");
  }
  const options: FilterOptions = {};
  let format = "markdown";
  let comparePath: string | undefined;
  let historyPaths: string | undefined;
  const seen = new Set<string>();
  for (const arg of args.slice(1)) {
    const match = /^--([a-z]+)=(.*)$/.exec(arg);
    if (!match) throw new Error("opcao invalida: " + arg);
    const [, name, value] = match;
    if (seen.has(name)) throw new Error("opcao duplicada: " + name);
    seen.add(name);
    switch (name) {
      case "format":
        if (!["markdown", "csv", "json", "plan"].includes(value)) throw new Error("formato invalido");
        format = value;
        break;
      case "status":
        if (!["aprovado", "pendente", "nao_aplicavel"].includes(value)) throw new Error("status invalido");
        options.status = value as Status;
        break;
      case "query": options.query = value; break;
      case "sort":
        if (!["id", "titulo", "status"].includes(value)) throw new Error("ordenacao invalida");
        options.sort = value as FilterOptions["sort"];
        break;
      case "offset": options.offset = parseInteger(value, name); break;
      case "limit": options.limit = parseInteger(value, name); break;
      case "history":
        if (!value) throw new Error("lista de historico vazia");
        historyPaths = value;
        break;
      case "compare":
        if (!value) throw new Error("caminho de comparacao vazio");
        comparePath = value;
        break;
      default: throw new Error("opcao desconhecida: " + name);
    }
  }
  const assessment = readAssessment(args[0]);
  if (comparePath !== undefined && historyPaths !== undefined) {
    throw new Error("comparacao e historico nao podem ser combinados");
  }
  if (historyPaths !== undefined) {
    if (Object.keys(options).length || !["markdown", "json"].includes(format)) {
      throw new Error("historico aceita apenas markdown ou json sem filtros");
    }
    const paths = historyPaths.split(",");
    if (paths.length < 1 || paths.length > 51 || paths.some((path) => !path.trim())) {
      throw new Error("historico exige entre 1 e 51 arquivos anteriores");
    }
    const history = buildHistory([...paths.map((path) => readAssessment(path.trim())), assessment]);
    process.stdout.write(format === "json"
      ? JSON.stringify(history, null, 2) + "\n"
      : renderHistoryMarkdown(history));
    return;
  }
  if (comparePath !== undefined) {
    if (format !== "markdown" || Object.keys(options).length) {
      throw new Error("comparacao nao aceita filtros nem outros formatos");
    }
    process.stdout.write(renderComparisonMarkdown(compareAssessments(readAssessment(comparePath), assessment)));
    return;
  }
  if (format === "json") {
    process.stdout.write(renderSummaryJson(assessment, options));
    return;
  }
  const selected = filterChecks(assessment, options);
  if (format === "plan") {
    process.stdout.write(renderRemediationMarkdown(
      buildRemediationPlan({ ...assessment, itens: selected.itens })));
    return;
  }
  if (format === "csv") {
    process.stdout.write(renderCsv(assessment, selected.itens));
  } else {
    process.stdout.write(renderMarkdown({ ...assessment, itens: selected.itens }));
  }
}
try {
  main();
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  process.stderr.write("Erro: " + message + "\n");
  process.exitCode = 2;
}
