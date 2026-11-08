# Checklist de Acessibilidade

Primeiro MVP funcional em **TypeScript**, para registrar verificacoes manuais de acessibilidade de uma pagina e exportar resultado em Markdown.

## O que funciona

- Registra pagina, data, identificador, criterio, estado e evidencia.
- Diferencia **aprovado**, **pendente** e **nao_aplicavel**.
- Recusa IDs duplicados, datas invalidas e estados desconhecidos.
- Mantem as evidencias no relatorio, escapando marcacao Markdown enviada como texto.
- Gera contagem por estado e relatorio legivel para revisao.

## Executar

Requer Node.js 22+ e npm. Os dados no exemplo sao ficticios.

```bash
npm install
npm run build
node dist/cli.js examples/avaliacao.json > relatorio.md
npm test
```

O relatorio sera criado em `relatorio.md` no diretorio atual. Consulte `examples/avaliacao.json` para preencher sua avaliacao.

## Criterios de aceite cobertos

- [x] Criar uma avaliacao de pagina a partir de JSON
- [x] Registrar verificacoes, status e evidencia
- [x] Exportar Markdown preservando os itens
- [x] Testar tratamento de entradas invalidas

## Limites e proximas etapas

Este checklist **nao realiza auditoria automatica nem certifica conformidade WCAG**. A verificacao de teclado, rotulos e contraste precisa ser feita por quem avalia. Uma interface web em Svelte e persistencia editavel sao evolucoes futuras. Nenhuma integracao externa nem credencial e exigida.
