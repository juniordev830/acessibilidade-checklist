const test = require("node:test");
const assert = require("node:assert/strict");
const { validateAssessment } = require("../dist/report.js");
const { buildHistory, renderHistoryMarkdown } = require("../dist/history.js");
const check = (id, status, titulo = id) => ({ id, titulo, status, evidencia: "Evidencia registrada" });
const make = (data, itens, pagina = "https://exemplo.local") =>
  validateAssessment({ pagina, data, itens });
const series = () => [
  make("2026-11-01", [check("teclado", "pendente"), check("rotulos", "aprovado")]),
  make("2026-11-04", [check("teclado", "aprovado"), check("rotulos", "pendente"), check("contraste", "pendente")]),
  make("2026-11-08", [check("teclado", "pendente"), check("rotulos", "aprovado"), check("contraste", "aprovado")]),
];
test("historico soma transicoes entre avaliacoes consecutivas", () => {
  const h = buildHistory(series());
  assert.deepEqual(h.totais, { melhorias: 3, regressoes: 2, inclusoes: 1, remocoes: 0 });
});
test("historico guarda um snapshot para cada data", () => {
  const h = buildHistory(series());
  assert.deepEqual(h.snapshots.map((s) => s.data), ["2026-11-01", "2026-11-04", "2026-11-08"]);
});
test("historico informa regressoes com data e criterio", () => {
  const h = buildHistory(series());
  assert.equal(h.regressoes.length, 2);
  assert.deepEqual(h.regressoes.map((r) => r.id), ["rotulos", "teclado"]);
  assert.equal(h.regressoes[0].dataAtual, "2026-11-04");
});
test("historico preserva lacunas quando item nao existia", () => {
  const h = buildHistory(series());
  assert.deepEqual(h.criterios.find((x) => x.id === "contraste").estados, [
    null, "pendente", "aprovado",
  ]);
});
test("historico calcula mudancas de status por criterio", () => {
  const h = buildHistory(series());
  assert.equal(h.criterios.find((x) => x.id === "teclado").mudancasDeStatus, 2);
  assert.equal(h.criterios.find((x) => x.id === "contraste").mudancasDeStatus, 1);
});
test("historico rejeita menos de duas avaliacoes", () => {
  assert.throws(() => buildHistory([series()[0]]), /entre 2 e 52/);
});
test("historico rejeita mais de 52 avaliacoes", () => {
  assert.throws(() => buildHistory(Array(53).fill(series()[0])), /entre 2 e 52/);
});
test("historico rejeita paginas diferentes", () => {
  const a = series();
  a[1].pagina = "https://outro.local";
  assert.throws(() => buildHistory(a), /mesma pagina/);
});
test("historico rejeita datas fora de ordem", () => {
  const a = series();
  [a[1], a[2]] = [a[2], a[1]];
  assert.throws(() => buildHistory(a), /crescentes/);
});
test("historico rejeita snapshots do mesmo dia", () => {
  const a = series();
  a[1].data = a[0].data;
  assert.throws(() => buildHistory(a), /crescentes/);
});
test("historico calcula primeira e ultima aparicao", () => {
  const h = buildHistory(series());
  const c = h.criterios.find((x) => x.id === "contraste");
  assert.equal(c.primeiraData, "2026-11-04");
  assert.equal(c.ultimaData, "2026-11-08");
});
test("historico nao considera ausencia como regressao", () => {
  const h = buildHistory([
    make("2026-11-01", [check("a", "aprovado"), check("b", "pendente")]),
    make("2026-11-08", [check("a", "aprovado")]),
  ]);
  assert.equal(h.totais.remocoes, 1);
  assert.equal(h.totais.regressoes, 0);
});
test("markdown inclui datas, trajetoria e regressao", () => {
  const md = renderHistoryMarkdown(buildHistory(series()));
  assert.match(md, /2026-11-08/);
  assert.match(md, /pendente → aprovado → pendente/);
  assert.match(md, /Regressoes observadas/);
});
test("markdown escapa texto nao confiavel", () => {
  const a = series();
  a[0].pagina = "https://exemplo.local/a|b";
  a[1].pagina = a[0].pagina; a[2].pagina = a[0].pagina;
  const md = renderHistoryMarkdown(buildHistory(a));
  assert.ok(md.includes("a\\|b"));
});
test("historico com criterios sem aplicabilidade apresenta N/A", () => {
  const h = buildHistory([
    make("2026-11-01", [check("x", "nao_aplicavel")]),
    make("2026-11-08", [check("x", "nao_aplicavel")]),
  ]);
  assert.match(renderHistoryMarkdown(h), /\| N\/A \|/);
});
