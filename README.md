# Checklist de Acessibilidade

Ferramenta local em **TypeScript** para documentar verificacoes **manuais** de acessibilidade. Valida entradas, organiza evidencias, compara revisoes e exporta relatorios sem transmitir dados a servicos externos.

## Recursos

- Cadastro de pagina, data, verificacoes com IDs unicos, status e evidencia.
- Validacao de datas reais, tamanho dos campos e limite de 100 verificacoes por avaliacao.
- Exportacao Markdown com escape de caracteres de formatacao.
- Exportacao CSV RFC4180 com protecao contra interpretacao de formulas por planilhas.
- Relatorio JSON com indicadores globais, agrupamento por prefixo do ID, paginacao e alertas de qualidade.
- Busca por texto sem diferenciar acentos e maiusculas, filtro por estado, ordenacao e paginacao.
- Comparacao de duas avaliacoes da **mesma pagina**: melhorias, regressoes, mudancas de aplicabilidade, inclusoes e exclusoes.
- Diagnostico de evidencias ausentes/curtas e titulos possivelmente duplicados.
- Testes automatizados Node.js e compilacao TypeScript estrita.

## Executar

Requer Node.js 22+ e npm. Dados de exemplo ficticios:

```bash
npm install
npm test
node dist/cli.js examples/avaliacao.json
node dist/cli.js examples/avaliacao.json --format=csv > checklist.csv
node dist/cli.js examples/avaliacao.json --format=json --status=pendente --limit=20 > pendencias.json
node dist/cli.js examples/avaliacao.json --query=teclado --sort=titulo
node dist/cli.js atual.json --compare=anterior.json > evolucao.md
```

Opcoes: `--format=markdown|csv|json`, `--status=aprovado|pendente|nao_aplicavel`, `--query=texto`, `--sort=id|titulo|status`, `--offset=N`, `--limit=N` (1 a 100), `--compare=arquivo.json`. O formato padrao e Markdown. Comparacoes nao aceitam filtros ou formatos alternativos.

O campo `id` pode usar prefixos como `form:rotulos` e `midia:legendas` para agrupar criterios. IDs precisam permanecer estaveis entre revisoes para comparacoes confiaveis.

## Interpretacao responsavel

**Nao e um validador automatico de WCAG nem certificacao de conformidade.** Os resultados dependem de revisoes manuais qualificadas. A taxa de aprovacao considera apenas itens aplicaveis; quando nenhum e aplicavel, retorna `null`. Evidencias vazias geram alertas de qualidade, nao aprovacao automatica.

A comparacao exige mesma URL e data anterior nao posterior a data atual. Um item removido e reportado como removido, nao como melhoria. Mudancas envolvendo `nao_aplicavel` sao classificadas separadamente.

Os arquivos sao processados localmente. **Nao armazene dados sensiveis em repositorios publicos.** A exportacao CSV evita interpretacao de formulas por planilhas, mas nao substitui controles de seguranca da ferramenta de destino.

## Proximos passos

Interface web, armazenamento editavel, trilha de revisoes assinada e mapeamento assistido de criterios WCAG podem ser implementados em evolucoes futuras.

## Planejamento de correcoes e historico

O formato `plan` gera um backlog de itens pendentes com checkboxes e instrucoes para coleta de evidencia, sem inventar severidade ou estimativa de esforco:

```bash
node dist/cli.js examples/avaliacao.json --format=plan > plano.md
```

Para analisar uma serie temporal da mesma pagina, forneca arquivos anteriores em ordem cronologica e o arquivo atual como primeiro argumento:

```bash
node dist/cli.js atual.json --history=anterior1.json,anterior2.json > historico.md
node dist/cli.js atual.json --history=anterior1.json,anterior2.json --format=json > historico.json
```

O historico aceita entre 2 e 52 avaliacoes, datas estritamente crescentes e a mesma pagina. Relata transicoes por criterio e regressoes, sem considerar itens excluidos como melhorias. Nao infere resultados de testes de acessibilidade; apenas compara evidencias registradas manualmente.
