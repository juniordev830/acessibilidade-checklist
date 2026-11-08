const test = require("node:test");
const assert = require("node:assert/strict");
const { validateAssessment } = require("../dist/report.js");
const { compareAssessments, renderComparisonMarkdown } = require("../dist/compare.js");
const make = (date, itens, pagina = "https://exemplo.local/portal") =>
  validateAssessment({ pagina, data: date, itens });
const item = (id, status, evidencia = "Evidencia completa") => ({
  id, titulo: "Verificacao " + id, status, evidencia,
});
const previous = () => make("2026-11-01", [
  item("a", "pendente"), item("b", "aprovado"), item("c", "nao_aplicavel"),
  item("d", "pendente"), item("e", "aprovado"),
]);
const current = () => make("2026-11-08", [
  item("a", "aprovado"), item("b", "pendente"), item("c", "aprovado"),
  item("d", "pendente", "Evidencia atualizada"), item("f", "aprovado"),
]);
test("identifica melhoria, regressao, aplicabilidade, remocao e adicao", () => {
  const comparison = compareAssessments(previous(), current());
  assert.deepEqual(comparison.resumo, {
    novo: 1, removido: 1, melhorou: 1, regrediu: 1,
    aplicabilidade: 1, inalterado: 1,
  });
});
test("ordena alteracoes por id de forma deterministica", () => {
  const comparison = compareAssessments(previous(), current());
  assert.deepEqual(comparison.alteracoes.map((x) => x.id), ["a", "b", "c", "d", "e", "f"]);
});
test("evidencia alterada nao muda classificacao de status", () => {
  const result = compareAssessments(previous(), current()).alteracoes.find((x) => x.id === "d");
  assert.equal(result.tipo, "inalterado");
  assert.equal(result.evidenciaAlterada, true);
});
test("novos e removidos possuem lado nulo", () => {
  const items = compareAssessments(previous(), current()).alteracoes;
  assert.equal(items.find((x) => x.id === "e").depois, null);
  assert.equal(items.find((x) => x.id === "f").antes, null);
});
test("nao compara paginas diferentes", () => {
  assert.throws(() => compareAssessments(previous(), make("2026-11-08", [item("a", "aprovado")], "https://outro.local")), /mesma pagina/);
});
test("nao compara snapshots em ordem temporal invertida", () => {
  assert.throws(() => compareAssessments(current(), previous()), /data atual/);
});
test("aceita duas avaliacoes do mesmo dia", () => {
  const a = previous();
  const b = previous();
  assert.equal(compareAssessments(a, b).resumo.inalterado, 5);
});
test("alteracao de titulo e detectada sem alterar o status", () => {
  const a = previous(); const b = previous();
  b.itens[0].titulo = "Titulo atualizado";
  const result = compareAssessments(a, b).alteracoes[0];
  assert.equal(result.tituloAlterado, true);
  assert.equal(result.tipo, "inalterado");
});
test("markdown apresenta resumo e tabela de transicoes", () => {
  const markdown = renderComparisonMarkdown(compareAssessments(previous(), current()));
  assert.match(markdown, /1 melhorias, 1 regressoes/);
  assert.match(markdown, /\| a \|/);
  assert.match(markdown, /Melhorou/);
  assert.match(markdown, /Evidencia alterada/);
});
test("markdown escapa caracteres especiais do usuario", () => {
  const a = previous(); const b = current();
  a.itens[0].titulo = "| texto **negrito**";
  b.itens[0].titulo = "| texto **negrito**";
  const markdown = renderComparisonMarkdown(compareAssessments(a, b));
  assert.ok(markdown.includes("\\| texto \\*\\*negrito\\*\\*"));
});
test("classifica pendente para nao aplicavel como aplicabilidade", () => {
  const a = make("2026-11-01", [item("x", "pendente")]);
  const b = make("2026-11-08", [item("x", "nao_aplicavel")]);
  assert.equal(compareAssessments(a, b).resumo.aplicabilidade, 1);
});
test("classifica aprovado para nao aplicavel como aplicabilidade", () => {
  const a = make("2026-11-01", [item("x", "aprovado")]);
  const b = make("2026-11-08", [item("x", "nao_aplicavel")]);
  assert.equal(compareAssessments(a, b).resumo.aplicabilidade, 1);
});
