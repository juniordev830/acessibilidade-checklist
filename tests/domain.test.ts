import {test} from "node:test";
import {strict as assert} from "node:assert";
import {initialChecks,markdown} from "../src/domain.ts";
test("relatório exporta situação e evidência para cada verificação",()=>{
 const checks=initialChecks.map(c=>({...c}));
 checks[0].status="aprovado";checks[0].evidence="Tab e Enter funcionam";
 checks[1].status="nao-aplicavel";checks[1].evidence="Página sem campos";
 const text=markdown("Cadastro",checks);
 assert.match(text,/Aprovado \| Tab e Enter funcionam/);
 assert.match(text,/Não aplicável \| Página sem campos/);
 assert.match(text,/Pendente/);
 assert.match(text,/não constitui auditoria/);
});
test("validação e escape de tabela",()=>{
 assert.throws(()=>markdown("  ",initialChecks));
 const txt=markdown("Página | Principal",initialChecks);
 assert.ok(txt.includes("Página \\| Principal"));
});
