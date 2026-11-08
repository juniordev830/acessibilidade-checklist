const test = require("node:test");
const assert = require("node:assert/strict");
const { validateAssessment } = require("../dist/report.js");
const {
  buildRemediationPlan, renderRemediationMarkdown, applyReview, pendingByCategory,
} = require("../dist/remediation.js");
const sample = () => validateAssessment({
  pagina: "https://exemplo.local",
  data: "2026-11-01",
  itens: [
    { id: "form:rotulos", titulo: "Rotulos", status: "pendente", evidencia: "Campo sem label" },
    { id: "form:teclado", titulo: "Teclado", status: "aprovado", evidencia: "Foco visivel" },
    { id: "midia:legendas", titulo: "Legendas", status: "nao_aplicavel", evidencia: "" },
    { id: "midia:alternativas", titulo: "Texto alternativo", status: "pendente", evidencia: "" },
  ],
});
test("plano inclui apenas pendencias", () => {
  const plan = buildRemediationPlan(sample());
  assert.equal(plan.totalPendentes, 2);
  assert.deepEqual(plan.tarefas.map((x) => x.id), ["midia:alternativas", "form:rotulos"]);
});
test("plano separa pendencias com e sem evidencia", () => {
  const plan = buildRemediationPlan(sample());
  assert.equal(plan.comEvidencia, 1);
  assert.equal(plan.semEvidencia, 1);
});
test("plano recomenda coletar evidencia antes de corrigir", () => {
  const plan = buildRemediationPlan(sample());
  assert.match(plan.tarefas[0].proximoPasso, /Reproduzir/);
  assert.match(plan.tarefas[1].proximoPasso, /corrigir/);
});
test("plano inclui categoria derivada do id", () => {
  assert.equal(buildRemediationPlan(sample()).tarefas[0].categoria, "midia");
});
test("markdown tem checkboxes e evidencias", () => {
  const md = renderRemediationMarkdown(buildRemediationPlan(sample()));
  assert.match(md, /- \[ \]/);
  assert.match(md, /Campo sem label/);
});
test("markdown sem pendencias nao inventa tarefas", () => {
  const a = sample(); a.itens = a.itens.filter((x) => x.status !== "pendente");
  assert.match(renderRemediationMarkdown(buildRemediationPlan(a)), /Nenhum item pendente/);
});
test("markdown escapa marcacao maliciosa", () => {
  const a = sample(); a.itens[0].evidencia = "| **falso**";
  const md = renderRemediationMarkdown(buildRemediationPlan(a));
  assert.ok(md.includes("\\| \\*\\*falso\\*\\*"));
});
test("revisao atomica altera apenas ids solicitados", () => {
  const original = sample();
  const updated = applyReview(original, "2026-11-08", [{
    id: "form:rotulos", status: "aprovado", evidencia: "Rotulo associado e validado",
  }]);
  assert.equal(updated.itens[0].status, "aprovado");
  assert.equal(updated.itens[1].status, "aprovado");
  assert.equal(original.itens[0].status, "pendente");
  assert.equal(updated.data, "2026-11-08");
});
test("revisao preserva a pagina", () => {
  const updated = applyReview(sample(), "2026-11-08", [{
    id: "form:rotulos", status: "pendente", evidencia: "Ainda sem label",
  }]);
  assert.equal(updated.pagina, "https://exemplo.local");
});
test("revisao rejeita id desconhecido", () => {
  assert.throws(() => applyReview(sample(), "2026-11-08", [{
    id: "desconhecido", status: "aprovado", evidencia: "ok",
  }]), /desconhecido/);
});
test("revisao rejeita ids duplicados", () => {
  const change = { id: "form:rotulos", status: "aprovado", evidencia: "Verificado" };
  assert.throws(() => applyReview(sample(), "2026-11-08", [change, change]), /duplicado/);
});
test("revisao rejeita evidencia vazia em item aplicavel", () => {
  assert.throws(() => applyReview(sample(), "2026-11-08", [{
    id: "form:rotulos", status: "aprovado", evidencia: " ",
  }]), /evidencia/);
});
test("revisao permite nao aplicavel sem evidencia", () => {
  const updated = applyReview(sample(), "2026-11-08", [{
    id: "form:rotulos", status: "nao_aplicavel", evidencia: "",
  }]);
  assert.equal(updated.itens[0].status, "nao_aplicavel");
});
test("revisao rejeita status desconhecido", () => {
  assert.throws(() => applyReview(sample(), "2026-11-08", [{
    id: "form:rotulos", status: "inventado", evidencia: "teste",
  }]), /status/);
});
test("revisao rejeita data anterior", () => {
  assert.throws(() => applyReview(sample(), "2026-10-30", [{
    id: "form:rotulos", status: "aprovado", evidencia: "teste",
  }]), /retroceder/);
});
test("revisao rejeita lista vazia", () => {
  assert.throws(() => applyReview(sample(), "2026-11-08", []), /entre 1 e 100/);
});
test("revisao valida titulo atualizado", () => {
  assert.throws(() => applyReview(sample(), "2026-11-08", [{
    id: "form:rotulos", status: "aprovado", evidencia: "teste", titulo: "",
  }]), /titulo/);
});
test("revisao permite atualizacao do titulo", () => {
  const updated = applyReview(sample(), "2026-11-08", [{
    id: "form:rotulos", status: "aprovado", evidencia: "teste", titulo: "Rotulos corrigidos",
  }]);
  assert.equal(updated.itens[0].titulo, "Rotulos corrigidos");
});
test("categorias pendentes nao incluem categorias completas", () => {
  const groups = pendingByCategory(sample());
  assert.deepEqual(groups, [
    { categoria: "form", pendentes: 1 },
    { categoria: "midia", pendentes: 1 },
  ]);
});
test("revisao preserva todos os itens mesmo com atualizacao parcial", () => {
  const updated = applyReview(sample(), "2026-11-08", [{
    id: "form:rotulos", status: "aprovado", evidencia: "Corrigido",
  }]);
  assert.equal(updated.itens.length, 4);
});
