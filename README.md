# Checklist de Acessibilidade — MVP Svelte

Aplicação web em **Svelte 5 + TypeScript** para revisões manuais de acessibilidade.

## Funcionalidades
- Cria uma avaliação para uma página ou URL.
- Registra verificações de teclado, rótulos e contraste.
- Cada item aceita **Aprovado**, **Pendente** ou **Não aplicável**, além de observação/evidência.
- Exporta o relatório em **Markdown**, preservando situação e evidência.

## Executar
Requer Node.js 22+:
```bash
npm install
npm run dev
```
Para testar e compilar:
```bash
npm test
npm run build
```

## Limitações
Os dados desta primeira versão são apenas da sessão corrente; exporte o arquivo para guardá-los. **Este checklist não é certificação de conformidade**, nem substitui testes com usuários e tecnologias assistivas.
