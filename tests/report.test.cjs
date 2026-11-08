const test = require("node:test");
const assert = require("node:assert/strict");
const { validateAssessment, renderMarkdown } = require("../dist/report.js");

const sample = () => ({
  pagina: "https://exemplo.local/formulario",
  data: "2026-11-08",
  itens: [
    { id: "teclado", titulo: "Navegacao por teclado", status: "aprovado", evidencia: "Tab alcanca todos os botoes" },
    { id: "rotulos", titulo: "Rotulos", status: "pendente", evidencia: "Campo email sem label" },
    { id: "contraste", titulo: "Contraste", status: "nao_aplicavel", evidencia: "Pagina sem textos visuais" }
  ],
});

test("preserva status e evidencia dos tres estados", () => {
  const md = renderMarkdown(validateAssessment(sample()));
  for (const word of ["Aprovado", "Pendente", "Nao aplicavel", "Tab alcanca", "Campo email"]) {
    assert.ok(md.includes(word), word);
  }
  assert.match(md, /1 aprovados, 1 pendentes, 1 nao aplicaveis/);
});

test("rejeita identificadores repetidos, datas invalidas e status desconhecidos", () => {
  const duplicate = sample();
  duplicate.itens[1].id = duplicate.itens[0].id;
  assert.throws(() => validateAssessment(duplicate), /duplicado/);
  const wrongDate = sample();
  wrongDate.data = "2026-02-30";
  assert.throws(() => validateAssessment(wrongDate), /data/);
  const wrongStatus = sample();
  wrongStatus.itens[0].status = "inventado";
  assert.throws(() => validateAssessment(wrongStatus), /status/);
  assert.throws(() => validateAssessment({}), /pagina/);
});

test("escapa marcacao e preserva texto multilinha da evidencia", () => {
  const entry = sample();
  entry.itens[0].evidencia = "**falso destaque**\n# titulo";
  const md = renderMarkdown(validateAssessment(entry));
  assert.ok(md.includes("\\*\\*falso destaque\\*\\*"));
  assert.ok(md.includes("↵"));
  assert.ok(!md.includes("\n# titulo"));
});
