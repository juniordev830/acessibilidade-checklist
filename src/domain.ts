export type Status="pendente"|"aprovado"|"nao-aplicavel";
export type Check={key:string;label:string;status:Status;evidence:string};
export const initialChecks:Check[]=[
 {key:"teclado",label:"Navegação completa pelo teclado",status:"pendente",evidence:""},
 {key:"rotulos",label:"Campos e controles possuem rótulos claros",status:"pendente",evidence:""},
 {key:"contraste",label:"Contraste de textos e controles foi verificado",status:"pendente",evidence:""}
];
const escapeCell=(s:string)=>s.replace(/\|/g,"\\|").replace(/\r?\n/g," ").trim();
export function markdown(page:string,checks:Check[]):string {
 const name=page.trim();if(!name)throw new Error("Informe a página avaliada.");
 const labels:Record<Status,string>={"pendente":"Pendente","aprovado":"Aprovado","nao-aplicavel":"Não aplicável"};
 return ["# Avaliação manual de acessibilidade","",`**Página:** ${escapeCell(name)}`,"","| Verificação | Situação | Evidência |","| --- | --- | --- |",...checks.map(c=>`| ${escapeCell(c.label)} | ${labels[c.status]} | ${escapeCell(c.evidence)} |`),"","_Checklist manual não constitui auditoria ou certificação de conformidade._",""].join("\n");
}
