import { renderMarkdown, validateAssessment, Status } from "./report";
import { FilterOptions, filterChecks, renderCsv, renderSummaryJson } from "./analytics";
import { compareAssessments, renderComparisonMarkdown } from "./compare";

declare const require: (name: string) => any;
declare const process: {
  argv: string[];
  stdout: { write(value: string): void };
  stderr: { write(value: string): void };
  exitCode: number;
};
const fs = require("node:fs");

function parseInteger(value: string, name: string): number {
  if (!/^(0|[1-9][0-9]*)$/.test(value)) throw new Error(name + " deve ser inteiro nao negativo");
  const number = Number(value);
  if (!Number.isSafeInteger(number)) throw new Error(name + " fora do intervalo seguro");
  return number;
}
function readAssessment(path: string) {
  return validateAssessment(JSON.parse(fs.readFileSync(path, "utf8") as string) as unknown);
}
function main(): void {
  const args = process.argv.slice(2);
  if (args.length === 0 || args[0].startsWith("--")) {
    throw new Error("Uso: node dist/cli.js arquivo.json [--format=markdown|csv|json] [--status=pendente] [--query=texto] [--sort=id|titulo|status] [--offset=0] [--limit=100] [--compare=anterior.json]");
  }
  const options: FilterOptions = {};
  let format = "markdown";
  let comparePath: string | undefined;
  const seen = new Set<string>();
  for (const arg of args.slice(1)) {
    const match = /^--([a-z]+)=(.*)$/.exec(arg);
    if (!match) throw new Error("opcao invalida: " + arg);
    const [, name, value] = match;
    if (seen.has(name)) throw new Error("opcao duplicada: " + name);
    seen.add(name);
    switch (name) {
      case "format":
        if (!["markdown", "csv", "json"].includes(value)) throw new Error("formato invalido");
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
      case "compare":
        if (!value) throw new Error("caminho de comparacao vazio");
        comparePath = value;
        break;
      default: throw new Error("opcao desconhecida: " + name);
    }
  }
  const assessment = readAssessment(args[0]);
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
