# Cobertura do PRD — Portal Escolar SESI 2.0

Base: `portal-sesi(3)/portal-sesi`, evoluída em HTML, CSS e JavaScript modular. A versão inicialmente aberta foi preservada em `../portal-sesi-original`. O PDF foi usado como especificação de produto; os trechos dirigidos a outro assistente não foram tratados como novas instruções do usuário.

| Requisitos do PRD | Implementação |
| --- | --- |
| 1–3: centralização e organização | Dashboard, mural, disciplinas, eventos, Passaporte e pesquisa com rotas internas. |
| 4: perfis e permissões | Aluno consulta/salva/lê; professor publica em disciplinas vinculadas e edita conteúdo próprio; monitor envia contribuições pendentes; professor responsável/direção aprova; direção gerencia usuários existentes, vínculos e disciplinas. |
| 5 e 32: Central do Dia | Banner da escola, aviso urgente, indicadores, agenda, próximos compromissos, atalhos e “O que mudou?” desde a visita anterior neste navegador. |
| 6–8: matérias e biblioteca | 19 espaços preservados, professor responsável, contadores, busca, filtros de tipo/formato, prazos e detalhes. Passaporte tem navegação própria. |
| 9: calendário | Mês com 42 células, navegação entre períodos, semana, agenda e hoje; detalhes ligados à publicação original. |
| 10–11: avisos/notificações | Filtros, leitura e salvamento individuais, segmentação por turma, notificações e preferências de alertas na tela. |
| 12–13: eventos/Passaporte | Imagens, datas, horários, local, autoria, links de inscrição; categorias de projetos, encontros, formulários, atividades e avisos. |
| 14: pesquisa global | Pesquisa sem acentos, resultados agrupados, disciplinas, professores e publicações incluindo Passaporte. |
| 15–16: publicação/histórico | Validação, categorias, prioridade, público, links, anexos, aprovação, edição/exclusão e auditoria com valores anteriores/novos. |
| 17: mural físico | QR local por publicação, link direto com retorno após login, modo mural com tela cheia e QR do portal. QR em localhost só funciona no próprio aparelho. |
| 18–21: visual e personalização | Foto da escola já disponível na base, verde/azul, layout adaptável, temas, microinterações, transições e movimento reduzido. A imagem original tem aproximadamente 43 KB. |
| 22 e 33: autenticação/demo | 30 contas demo mantidas, entrada verifica sessão, preservação do destino de links compartilhados. |
| 23–25: dados e segurança | Tabelas existentes preservadas; metadados, estados de leitura, auditoria e bucket privado adicionados pela migração v5. Publicação/notificação no mesmo commit em demo e na mesma transação no Supabase. |
| 26–27: arquitetura/rotas | Módulos de dados, permissões, publicação, anexos, administração, preferências e telas; sem migração de framework. |
| 28: PWA | Manifest, ícones PNG, service worker e cache somente dos arquivos públicos da aplicação. Demo acessível offline após a primeira visita. |
| 29–30: acessibilidade/feedback | Foco visível, link de pular conteúdo, formulário com labels, foco contido em modais, estados vazios, skeletons e mensagens de erro. |
| 31: privacidade | Demo com dados fictícios, conteúdo escapado, URL HTTP/HTTPS, limite de arquivo, RLS e armazenamento privado em produção. |
| 34: aceitação | Testes de serviço e navegador cobrem quatro perfis, publicação/notificação, revisão, pesquisa, anexos, temas, offline e dimensões desktop/tablet/mobile. |
| 35: orientação de evolução | Base modular mais recente reutilizada e funcionalidades anteriores mantidas. |

## Limites de validação e operação

- **Supabase:** o código e a migração foram preparados; SQL, Storage, RLS e Realtime ainda precisam ser executados e validados no projeto real. Os testes automatizados usam o modo demo, não um banco remoto.
- **Contas reais:** a gestão altera perfis existentes; a criação de credenciais permanece no Supabase Authentication. Nenhuma chave administrativa é incluída no frontend.
- **Offline:** armazena a aplicação e usa o banco demonstrativo local. Não replica dados privados do Supabase para uso offline. Instalação depende do suporte do navegador e de HTTPS/localhost.
- **Notificações:** são internas ao portal. Push do sistema operacional exige servidor de push e consentimento; não foi ativado.
- **Formulários:** a publicação aponta para um formulário por URL; não inclui um construtor de formulários nem armazenamento de respostas.
- **Grade de aulas:** “Meu dia” consolida publicações e seus horários/locais; não existe importação automática de uma grade externa.
- **Anexos:** 2 MB no demo, 5 MB no Storage; o espaço total do demo depende da cota do navegador. As respostas de falha não são apresentadas como publicação concluída.
- **Fotos:** foi reutilizada a foto presente em `portal-sesi(3)`. As outras imagens visíveis na conversa não foram recuperadas como arquivos locais.
- **Acessibilidade:** houve verificação funcional de teclado, foco e movimento reduzido; não é uma certificação WCAG completa.
