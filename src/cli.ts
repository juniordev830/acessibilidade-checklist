import { renderMarkdown, validateAssessment } from "./report";

declare const require: (name: string) => any;
declare const process: {
  argv: string[];
  stdout: { write(value: string): void };
  stderr: { write(value: string): void };
  exitCode: number;
};
const fs = require("node:fs");

function main(): void {
  const args = process.argv.slice(2);
  if (args.length !== 1) {
    throw new Error("Uso: node dist/cli.js examples/avaliacao.json");
  }
  const contents: string = fs.readFileSync(args[0], "utf8");
  const assessment = validateAssessment(JSON.parse(contents) as unknown);
  process.stdout.write(renderMarkdown(assessment));
}

try {
  main();
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  process.stderr.write("Erro: " + message + "\n");
  process.exitCode = 2;
}
