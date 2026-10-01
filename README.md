# Portal Escolar SESI 2.0

Evolução da base `portal-sesi(3)` a partir do PRD, com identidade verde/azul, foto da escola, animações acessíveis e fluxos escolares funcionais. HTML, CSS e JavaScript modular, sem framework.

## Abrir

Na pasta `portal-sesi`, com Node.js instalado:

```sh
npm start
```

Abra **http://localhost:4173**. No PowerShell, use `npm.cmd start` se houver bloqueio de scripts. Também funciona pelo Live Server. Os módulos precisam de HTTP; não abra o HTML por duplo clique. Não é necessário instalar dependências para usar a aplicação: o gerador de QR já está incluído em `js/vendor`.

## Contas de demonstração

| Perfil | E-mail | Senha |
| --- | --- | --- |
| Aluno | `aluno@demo` | Qualquer senha |
| Professor de Matemática | `prof@demo` | Qualquer senha |
| Monitor | `monitor@demo` | Qualquer senha |
| Direção | `admin@demo` | Qualquer senha |

As 30 contas da base foram preservadas. Consulte `CONTAS-DEMO.md` e a lista de professores no login. O demo usa dados fictícios no navegador; abas do mesmo endereço compartilham publicações, mas cada aba mantém sua sessão. Outro navegador/aparelho tem seus próprios dados.

## O que está disponível

- Dashboard com urgências, indicadores, semana, linha do tempo, acesso rápido e alterações desde a última visita.
- Disciplinas com professores responsáveis, busca, contadores, atividades, materiais, avisos e filtro de formato.
- Calendário mensal navegável, semana, agenda e hoje, sempre ligado à publicação original.
- Pesquisa global agrupada, central de avisos com filtros e publicações salvas/lidas por usuário.
- Passaporte independente, eventos com imagem e links de inscrição/formulário.
- Publicação por turma, anexos, prioridade, autoria e metadados de horário/local.
- Revisão de contribuições de monitores; edição, exclusão e mudança de prazo com auditoria e notificações.
- Administração de perfis existentes, turmas, disciplinas e vínculos de professores.
- QR Code gerado localmente; links diretos com retorno após login; modo mural com tela cheia.
- Temas claro/escuro/sistema, preferências de alertas, layout para celular/tablet/desktop e respeito a movimento reduzido.
- PWA com ícones e cache público; o demo funciona offline após a primeira visita completa.

Os monitores agora enviam publicações **pendentes**, que precisam ser aprovadas em **Gestão editorial**. Apenas a direção publica conteúdo institucional urgente e administra pessoas. Professores editam suas próprias publicações nas disciplinas vinculadas.

Os arquivos anexados aceitam PDF, JPG, PNG, WebP, TXT, DOCX e PPTX: até 2 MB no demo e 5 MB no Supabase. Links usam HTTP/HTTPS. As notificações são internas ao portal; push do sistema operacional não está configurado.

## Supabase

1. Em banco novo, execute `supabase/schema.sql` e as migrações **v2, v3, v4 e v5**, nessa ordem. Em banco existente, aplique somente as que faltam.
2. A v5 adiciona metadados, leitura/salvamento, revisão de monitores, autoria, segmentação por turma, auditoria e bucket privado de anexos. Ela restringe as permissões amplas de monitor da versão anterior.
3. Configure a URL e a chave pública em `js/config.js`. Nunca use a chave `service_role` no frontend.
4. Crie as credenciais reais em Authentication. Configure o primeiro perfil `system_admin` pelo SQL Editor e gerencie os demais perfis/vínculos no portal.
5. Publique a pasta em hospedagem estática HTTPS e valide as políticas com os quatro perfis reais antes do uso escolar.

**O banco remoto não foi configurado nesta entrega.** A migração foi fornecida, mas não executada em um projeto Supabase. As verificações automatizadas abaixo exercitam o modo demo. O cache não guarda respostas de API do Supabase nem tenta oferecer acesso offline a dados privados remotos.

## Testes e cache

```sh
npm test
npm run test:browser
npm run build:offline
```

No PowerShell, pode ser necessário usar `npm.cmd`. O teste de navegador usa Chrome headless em um perfil temporário, sem modificar seu navegador habitual. Defina `CHROME_BIN` se o executável estiver em outro caminho.

Os testes verificam permissões, aprovação, audiência, notificações, auditoria, leitura individual, validação, login, anexos, QR, pesquisa, calendário, temas e layout. Há capturas de desktop, tablet e celular em `test-artifacts/`. Refaça `build:offline` depois de alterar arquivos da aplicação: o script gera a versão do cache a partir do conteúdo.

## Organização

- `js/app.js`: shell e roteamento.
- `js/portal.js`: dashboard e telas do PRD.
- `js/community.js`: mural e disciplinas.
- `js/management.js`: administração de pessoas/disciplinas.
- `js/services/`: dados, publicações, anexos, notificações e perfil.
- `js/components/`: publicação, modais e central de notificações.
- `css/portal.css`: evolução visual e movimento.
- `supabase/migration_v5.sql`: persistência e permissões da evolução.
- `PRD-STATUS.md`: rastreabilidade dos requisitos e limites de validação.

O QR utiliza `qrcode-generator` 2.0.4, licença MIT preservada em `js/vendor/`. A foto de aproximadamente 43 KB já estava disponível na base `portal-sesi(3)`. Os dados existentes do demo são migrados de forma aditiva.
