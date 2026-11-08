const test = require("node:test");
const assert = require("node:assert/strict");
const { validateAssessment } = require("../dist/report.js");
const {
  filterChecks, summarizeAssessment, inspectEvidence,
  summarizeCategories, renderCsv, renderSummaryJson,
} = require("../dist/analytics.js");
const sample = () => validateAssessment({
  pagina: "https://exemplo.local/portal",
  data: "2026-11-08",
  itens: [
    { id: "form:rotulos", titulo: "Rótulos de campos", status: "pendente", evidencia: "Campo de email sem label" },
    { id: "form:teclado", titulo: "Teclado", status: "aprovado", evidencia: "Tab percorre todos os controles" },
    { id: "midia:legendas", titulo: "Legendas", status: "nao_aplicavel", evidencia: "" },
    { id: "form:contraste", titulo: "Contraste", status: "aprovado", evidencia: "" },
  ],
});
test("resumo contabiliza estados e taxa apenas dos aplicaveis", () => {
  assert.deepEqual(summarizeAssessment(sample()), {
    total: 4, aprovado: 2, pendente: 1, nao_aplicavel: 1,
    aplicaveis: 3, taxaAprovacao: 66.67, comEvidencia: 2, semEvidencia: 2,
  });
});
test("resumo sem criterios aplicaveis nao divide por zero", () => {
  const only = sample(); only.itens = [only.itens[2]];
  assert.equal(summarizeAssessment(only).taxaAprovacao, null);
});
test("filtra por estado sem alterar objeto original", () => {
  const data = sample();
  const result = filterChecks(data, { status: "pendente" });
  assert.deepEqual(result.itens.map((x) => x.id), ["form:rotulos"]);
  assert.equal(data.itens.length, 4);
});
test("busca por texto em id, titulo e evidencia ignorando acentos", () => {
  assert.equal(filterChecks(sample(), { query: "ROTULOS" }).total, 1);
  assert.equal(filterChecks(sample(), { query: "email" }).total, 1);
  assert.equal(filterChecks(sample(), { query: "MÍDIA" }).total, 1);
});
test("ordena naturalmente por id", () => {
  const result = filterChecks(sample());
  assert.deepEqual(result.itens.map((x) => x.id), [
    "form:contraste", "form:rotulos", "form:teclado", "midia:legendas",
  ]);
});
test("ordena por titulo decrescente", () => {
  const result = filterChecks(sample(), { sort: "titulo", direction: "desc" });
  assert.equal(result.itens[0].titulo, "Teclado");
});
test("paginacao informa total mesmo com pagina vazia", () => {
  const result = filterChecks(sample(), { offset: 100, limit: 2 });
  assert.equal(result.total, 4);
  assert.deepEqual(result.itens, []);
  assert.equal(result.offset, 100);
});
test("rejeita paginacao fracionaria, negativa, infinita ou excessiva", () => {
  for (const opts of [
    { limit: 0 }, { limit: 101 }, { offset: -1 }, { offset: 1.5 },
    { limit: Infinity }, { offset: NaN }, { offset: 1000001 },
  ]) assert.throws(() => filterChecks(sample(), opts));
});
test("rejeita filtro de status e ordenacao invalidos", () => {
  assert.throws(() => filterChecks(sample(), { status: "inventado" }));
  assert.throws(() => filterChecks(sample(), { sort: "inventado" }));
  assert.throws(() => filterChecks(sample(), { direction: "invertido" }));
});
test("rejeita consulta excessiva", () => {
  assert.throws(() => filterChecks(sample(), { query: "x".repeat(201) }));
});
test("qualidade aponta evidencia ausente somente quando aplicavel", () => {
  const findings = inspectEvidence(sample());
  assert.deepEqual(findings.map((x) => x.id), ["form:contraste"]);
  assert.equal(findings[0].code, "EVIDENCIA_AUSENTE");
});
test("qualidade detecta evidencia curta e titulos repetidos", () => {
  const data = sample();
  data.itens[0].evidencia = "curta";
  data.itens[1].titulo = data.itens[0].titulo;
  const codes = inspectEvidence(data).map((x) => x.code);
  assert.ok(codes.includes("EVIDENCIA_CURTA"));
  assert.ok(codes.includes("TITULO_REPETIDO"));
});
test("agrupa por prefixo sem confundir ids gerais", () => {
  assert.deepEqual(summarizeCategories(sample()), [
    { categoria: "form", total: 3, aprovado: 2, pendente: 1, nao_aplicavel: 0 },
    { categoria: "midia", total: 1, aprovado: 0, pendente: 0, nao_aplicavel: 1 },
  ]);
});
test("csv produz cabecalho e linhas RFC4180", () => {
  const csv = renderCsv(sample());
  assert.ok(csv.startsWith('"pagina","data","id","titulo","status","evidencia"\r\n'));
  assert.equal(csv.trimEnd().split("\r\n").length, 5);
});
test("csv escapa aspas, virgulas e formula de planilha", () => {
  const data = sample();
  data.itens[0].evidencia = ' =HYPERLINK("x","y"),foo';
  data.itens[1].titulo = "@SUM(A1:A2)";
  const csv = renderCsv(data);
  assert.ok(csv.includes('"\' =HYPERLINK(""x"",""y""),foo"'));
  assert.ok(csv.includes('"\'@SUM(A1:A2)"'));
});
test("csv impede formulas precedidas por quebras e tabulacoes", () => {
  const data = sample();
  data.itens[0].evidencia = "\t\n+CMD";
  assert.ok(renderCsv(data).includes('"\'\t\n+CMD"'));
});
test("csv respeita selecao filtrada", () => {
  const data = sample();
  const selected = filterChecks(data, { status: "pendente" });
  assert.equal(renderCsv(data, selected.itens).trimEnd().split("\r\n").length, 2);
});
test("json inclui resumo global e pagina filtrada", () => {
  const data = JSON.parse(renderSummaryJson(sample(), { status: "pendente", limit: 1 }));
  assert.equal(data.resumo.total, 4);
  assert.equal(data.paginacao.total, 1);
  assert.equal(data.itens.length, 1);
  assert.equal(data.categorias.length, 2);
});
test("json contem diagnosticos sem perder evidencias", () => {
  const data = JSON.parse(renderSummaryJson(sample()));
  assert.equal(data.qualidade[0].code, "EVIDENCIA_AUSENTE");
  assert.equal(data.itens.find((x) => x.id === "form:rotulos").evidencia, "Campo de email sem label");
});
