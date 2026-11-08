const test = require("node:test");
const assert = require("node:assert/strict");
const { spawnSync } = require("node:child_process");
const { mkdtempSync, writeFileSync, rmSync } = require("node:fs");
const { tmpdir } = require("node:os");
const { join } = require("node:path");
function withFiles(fn) {
  const dir = mkdtempSync(join(tmpdir(), "checklist-history-"));
  try {
    const paths = ["anterior.json", "atual.json"].map((name) => join(dir, name));
    const data = (date, status) => ({
      pagina: "https://exemplo.local", data: date,
      itens: [{ id: "teclado", titulo: "Teclado", status, evidencia: "Teste manual registrado" }],
    });
    writeFileSync(paths[0], JSON.stringify(data("2026-11-01", "pendente")));
    writeFileSync(paths[1], JSON.stringify(data("2026-11-08", "aprovado")));
    return fn(...paths);
  } finally { rmSync(dir, { recursive: true, force: true }); }
}
const run = (args) => spawnSync(process.execPath, ["dist/cli.js", ...args], { encoding: "utf8" });
test("cli exporta historico markdown", () => withFiles((old, now) => {
  const result = run([now, "--history=" + old]);
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /Historico de verificacoes/);
  assert.match(result.stdout, /pendente → aprovado/);
}));
test("cli exporta historico json", () => withFiles((old, now) => {
  const result = run([now, "--history=" + old, "--format=json"]);
  assert.equal(result.status, 0, result.stderr);
  assert.equal(JSON.parse(result.stdout).totais.melhorias, 1);
}));
test("cli exporta plano com apenas pendencias", () => withFiles((old) => {
  const result = run([old, "--format=plan"]);
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /Plano de correcoes/);
  assert.match(result.stdout, /teclado/);
}));
test("cli nao inventa pendencias para itens aprovados", () => withFiles((old, now) => {
  const result = run([now, "--format=plan"]);
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /Nenhum item pendente/);
}));
test("cli rejeita historico combinado com comparacao", () => withFiles((old, now) => {
  const result = run([now, "--history=" + old, "--compare=" + old]);
  assert.equal(result.status, 2);
  assert.match(result.stderr, /nao podem ser combinados/);
}));
test("cli rejeita historico com filtros", () => withFiles((old, now) => {
  const result = run([now, "--history=" + old, "--status=aprovado"]);
  assert.equal(result.status, 2);
  assert.match(result.stderr, /sem filtros/);
}));
test("cli rejeita historico sem caminho", () => withFiles((old, now) => {
  const result = run([now, "--history="]);
  assert.equal(result.status, 2);
  assert.match(result.stderr, /vazia/);
}));
test("cli rejeita historico em formato csv", () => withFiles((old, now) => {
  const result = run([now, "--history=" + old, "--format=csv"]);
  assert.equal(result.status, 2);
}));
test("cli aceita plano filtrado", () => withFiles((old) => {
  const result = run([old, "--format=plan", "--status=pendente"]);
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /Pendentes:.*1/);
}));
