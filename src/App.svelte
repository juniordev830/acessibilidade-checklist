<script lang="ts">
 import {initialChecks,markdown,type Check,type Status} from "./domain.ts";
 let page = "";
 let checks:Check[] = initialChecks.map(c=>({...c}));
 let error = "";
 function setStatus(key:string,status:Status){checks=checks.map(c=>c.key===key?{...c,status}:c);}
 function setEvidence(key:string,evidence:string){checks=checks.map(c=>c.key===key?{...c,evidence}:c);}
 function exportReport(){
  try{
   const content=markdown(page,checks);
   const url=URL.createObjectURL(new Blob([content],{type:"text/markdown;charset=utf-8"}));
   const link=document.createElement("a");link.href=url;link.download="avaliacao-acessibilidade.md";link.click();
   setTimeout(()=>URL.revokeObjectURL(url),1000);error="";
  }catch(e){error=e instanceof Error?e.message:String(e);}
 }
</script>
<svelte:head><title>Checklist de Acessibilidade</title></svelte:head>
<main><header><h1>♿ Checklist de Acessibilidade</h1><p>Revise manualmente a experiência de uma página. Esta ferramenta não equivale a uma certificação WCAG.</p></header>
 <section><label>Página ou URL avaliada <input aria-label="Página avaliada" bind:value={page} placeholder="Ex.: Página de cadastro" maxlength="200" /></label></section>
 <section><h2>Verificações</h2>{#each checks as item (item.key)}
 <article><h3>{item.label}</h3><div class="fields"><label>Situação<select aria-label={"Situação: "+item.label} value={item.status} on:change={e=>setStatus(item.key,e.currentTarget.value as Status)}><option value="pendente">Pendente</option><option value="aprovado">Aprovado</option><option value="nao-aplicavel">Não aplicável</option></select></label>
 <label>Evidência ou observação<textarea aria-label={"Evidência: "+item.label} rows="2" value={item.evidence} on:input={e=>setEvidence(item.key,e.currentTarget.value)} placeholder="Registre a verificação realizada"></textarea></label></div></article>
 {/each}</section><button on:click={exportReport}>Exportar relatório Markdown</button>{#if error}<p role="alert" class="error">{error}</p>{/if}
</main>
