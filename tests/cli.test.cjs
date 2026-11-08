const test = require("node:test");
const assert = require("node:assert/strict");
const { spawnSync } = require("node:child_process");
const { mkdtempSync, writeFileSync, rmSync } = require("node:fs");
const { tmpdir } = require("node:os");
const { join } = require("node:path");
const sample = {
  pagina: "https://exemplo.local/portal",
  data: "2026-11-08",
  itens: [
    { id: "teclado", titulo: "Teclado", status: "aprovado", evidencia: "Foco visivel em todos os botoes" },
    { id: "rotulos", titulo: "Rotulos", status: "pendente", evidencia: "Campo sem label" },
  ],
};
function run(args) {
  return spawnSync(process.execPath, ["dist/cli.js", ...args], { encoding: "utf8" });
}
function withFixtures(fn) {
  const dir = mkdtempSync(join(tmpdir(), "checklist-"));
  try {
    const now = join(dir, "atual.json");
    const old = join(dir, "anterior.json");
    writeFileSync(now, JSON.stringify(sample));
    writeFileSync(old, JSON.stringify({ ...sample, data: "2026-11-01",
      itens: sample.itens.map((x) => ({ ...x, status: "pendente" })) }));
    return fn(now, old);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}
test("cli continua aceitando uso original em markdown", () => withFixtures((now) => {
  const result = run([now]);
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /Checklist de acessibilidade/);
}));
test("cli exporta csv filtrado", () => withFixtures((now) => {
  const result = run([now, "--format=csv", "--status=pendente"]);
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /rotulos/);
  assert.doesNotMatch(result.stdout, /teclado/);
}));
test("cli exporta json com resumo global", () => withFixtures((now) => {
  const result = run([now, "--format=json", "--limit=1"]);
  assert.equal(result.status, 0, result.stderr);
  const value = JSON.parse(result.stdout);
  assert.equal(value.resumo.total, 2);
  assert.equal(value.itens.length, 1);
}));
test("cli compara avaliacoes", () => withFixtures((now, old) => {
  const result = run([now, "--compare=" + old]);
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /1 melhorias/);
}));
test("cli rejeita formato invalido", () => withFixtures((now) => {
  const result = run([now, "--format=xml"]);
  assert.equal(result.status, 2);
  assert.match(result.stderr, /formato invalido/);
}));
test("cli rejeita opcoes repetidas", () => withFixtures((now) => {
  const result = run([now, "--limit=1", "--limit=2"]);
  assert.equal(result.status, 2);
  assert.match(result.stderr, /duplicada/);
}));
test("cli rejeita paginacao fracionaria", () => withFixtures((now) => {
  const result = run([now, "--offset=1.5"]);
  assert.equal(result.status, 2);
}));
test("cli rejeita comparacao com filtros", () => withFixtures((now, old) => {
  const result = run([now, "--compare=" + old, "--status=pendente"]);
  assert.equal(result.status, 2);
  assert.match(result.stderr, /comparacao nao aceita/);
}));
test("cli rejeita arquivo maior que 1 MB antes de analisar JSON", () => withFixtures((now) => {
  writeFileSync(now, " ".repeat(1_000_001));
  const result = run([now]);
  assert.equal(result.status, 2);
  assert.match(result.stderr, /limite de 1 MB/);
}));

test("cli rejeita caminho de diretorio como arquivo de avaliacao", () => withFixtures((now) => {
  const { dirname } = require("node:path");
  const result = run([dirname(now)]);
  assert.equal(result.status, 2);
  assert.match(result.stderr, /regular/);
}));

test("cli rejeita arquivo inexistente com codigo de erro", () => {
  const result = run(["/nao-existe/arquivo.json"]);
  assert.equal(result.status, 2);
  assert.match(result.stderr, /Erro:/);
});
test("cli rejeita parametro desconhecido", () => withFixtures((now) => {
  const result = run([now, "--danger=1"]);
  assert.equal(result.status, 2);
  assert.match(result.stderr, /desconhecida/);
}));
