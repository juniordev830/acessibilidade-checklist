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
for (const sort of ["id", "titulo", "status"]) {
  test(`cli ordena ${sort} em ambas as direcoes antes de paginar`, () => withFixtures((now) => {
    const expected = sort === "status" ? ["teclado", "rotulos"] : ["rotulos", "teclado"];
    for (const direction of [undefined, "asc", "desc"]) {
      const args = [now, "--format=json", `--sort=${sort}`];
      if (direction) args.push(`--direction=${direction}`);
      const ordered = direction === "desc" ? [...expected].reverse() : expected;
      const result = run(args);
      assert.equal(result.status, 0, result.stderr);
      assert.deepEqual(JSON.parse(result.stdout).itens.map((item) => item.id), ordered);
      const page = run([...args, "--offset=1", "--limit=1"]);
      assert.equal(page.status, 0, page.stderr);
      assert.deepEqual(JSON.parse(page.stdout).itens.map((item) => item.id), ordered.slice(1));
    }
  }));
}
test("cli aplica direcao decrescente na ordenacao padrao", () => withFixtures((now) => {
  const result = run([now, "--format=json", "--direction=desc"]);
  assert.equal(result.status, 0, result.stderr);
  assert.deepEqual(JSON.parse(result.stdout).itens.map((item) => item.id), ["teclado", "rotulos"]);
}));
for (const direction of ["", "DESC", "invalida"]) {
  test(`cli rejeita direcao invalida ${JSON.stringify(direction)}`, () => withFixtures((now) => {
    const result = run([now, `--direction=${direction}`]);
    assert.equal(result.status, 2);
    assert.equal(result.stdout, "");
    assert.match(result.stderr, /direcao invalida/);
  }));
}
test("cli rejeita direcao repetida", () => withFixtures((now) => {
  const result = run([now, "--direction=asc", "--direction=desc"]);
  assert.equal(result.status, 2);
  assert.match(result.stderr, /opcao duplicada: direction/);
}));
for (const mode of ["compare", "history"]) {
  test(`cli rejeita direcao em modo ${mode}`, () => withFixtures((now, old) => {
    const result = run([now, `--${mode}=${old}`, "--direction=desc"]);
    assert.equal(result.status, 2);
    assert.equal(result.stdout, "");
    assert.match(result.stderr, mode === "compare" ? /comparacao nao aceita/ : /historico aceita apenas/);
  }));
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

test("cli rejeita UTF-8 invalido em campo JSON sem alterar silenciosamente evidencias", () =>
    withFixtures((now) => {
  const raw = Buffer.from(JSON.stringify(sample), "utf8");
  const marker = Buffer.from("Rotulos", "utf8");
  const index = raw.indexOf(marker);
  assert.ok(index >= 0, "marcador de titulo presente");
  raw[index] = 0xff;
  writeFileSync(now, raw);
  const result = run([now]);
  assert.equal(result.status, 2);
  assert.equal(result.stdout, "");
  assert.match(result.stderr, /encoded|UTF-8|utf-8/i);
}));

test("cli preserva titulos validos com acentos e aceita BOM UTF-8", () =>
    withFixtures((now) => {
  const accented = {
    ...sample,
    itens: sample.itens.map((item) => ({ ...item, titulo: "Rótulos e ações" })),
  };
  writeFileSync(now, Buffer.concat([
    Buffer.from([0xef, 0xbb, 0xbf]),
    Buffer.from(JSON.stringify(accented), "utf8"),
  ]));
  const result = run([now, "--format=json"]);
  assert.equal(result.status, 0, result.stderr);
  const parsed = JSON.parse(result.stdout);
  assert.equal(parsed.itens[0].titulo, "Rótulos e ações");
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
