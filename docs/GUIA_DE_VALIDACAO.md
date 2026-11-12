# Plano de validação de acessibilidade

O utilitário TypeScript registra avaliações **manuais** de acessibilidade e produz relatórios. Ele não substitui auditoria automatizada, leitor de tela ou teste com pessoas com deficiência.

## Módulos

- `src/cli.ts`: entrada de dados e comandos.
- `src/report.ts`: relatório.
- `src/analytics.ts`: indicadores.
- `src/compare.ts`: comparação de avaliações.
- `src/remediation.ts`: priorização de correções.
- `src/history.ts`: histórico local.

## Reproduzir

Usar os scripts de `package.json` com Node.js 22+, especialmente `npm test`, e validar saída Markdown, JSON e CSV com avaliações fictícias.

## Matriz mínima

- IDs duplicados, data inválida, mais de 100 verificações e evidência vazia.
- Regressão entre avaliações da mesma página, sem comparar páginas diferentes.
- Unicode, CSV injection, Markdown malicioso e escape correto de conteúdo.
- Ordenação e paginação com zero, um e muitos resultados.

## Próxima entrega

Adicionar exemplos de avaliação manual reproduzíveis com critérios WCAG identificados, sem afirmar conformidade automática. Conferir cada alteração em terminal e em leitor de relatório.
