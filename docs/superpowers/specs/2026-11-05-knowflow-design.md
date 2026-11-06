# KnowFlow AI — desenho da primeira versão

Data: 2026-11-05
Status: proposta para aprovação.

## Intenção e decisões acordadas

KnowFlow AI transforma documentos de uma organização em respostas verificáveis, orientação para realizar tarefas e encaminhamento humano. O produto atende diferentes áreas, sem regras de negócio fixas de TI, RH ou financeiro.

Refer�ncia visual: arquivo local privado, n�o inclu�do no reposit�rio.

## Objetivos e limites

Entregar um percurso completo: criar organização e equipe, convidar membros, enviar documentação, fazer perguntas com fontes, acompanhar passos quando apropriado e registrar uma solicitação interna quando necessário.

Perguntas simples recebem respostas diretas. Tarefas recebem um passo por vez quando a documentação sustenta a orientação. Ausência de evidência gera uma explicação do que falta ou encaminhamento; o modelo não deve completar procedimentos com conhecimento externo como se viessem da organização.

Ficam fora desta versão: OCR, integrações externas, cobrança, automações que executam ações em outros sistemas, busca entre equipes, compartilhamento público e personalização de fluxos por um construtor visual. Não apresentar demonstrações como processamento real nem afirmar resolução sem confirmação do usuário.

## Alternativas consideradas

1. Aplicação integrada: Next.js, PostgreSQL com pgvector, armazenamento privado de arquivos e execução de trabalhos em segundo plano. Menos serviços e interfaces para manter. Exige tirar processamento demorado do ciclo de requisição web.
2. Interface e serviço de IA separados: permite evolução independente do processamento, mas aumenta infraestrutura e manutenção inicial.

O usuário escolheu a aplicação integrada. O processamento em segundo plano pode usar o mesmo código e imagem de implantação em um processo trabalhador separado; isso não implica criar uma API de IA independente.

## Organização e acesso

Proposta de implementação: usuário pode pertencer a mais de uma organização, sem misturar contextos. Organização e equipe ativas aparecem claramente na navegação. Criar organização concede papel de administrador ao criador. Convites têm validade, uso único e vínculo ao email autenticado do destinatário.

- Administrador: gerencia organização, convites, equipes e respectivos membros. Para consultar conteúdo, deve pertencer à equipe; pode atribuir a si essa participação de forma explícita e auditada.
- Gestor: gerencia membros e documentos das equipes sob sua gestão e acompanha e atribui solicitações dessas equipes.
- Membro: consulta documentos e assistente das próprias equipes; cria e acompanha as próprias solicitações.

O administrador é um papel da organização; gestor e membro são papéis por equipe. Não há documento com exceção individual de acesso nesta versão: a equipe é a fronteira de visibilidade. Conversas são privadas ao autor. Gestores acessam apenas o histórico que o usuário incluir expressamente numa solicitação, não todas as conversas.

Toda leitura, download, busca, citação, trabalho em segundo plano e alteração verifica organização e equipe no servidor. Identificadores enviados pelo navegador não constituem autorização. Remover participação revoga acesso inclusive a conversas, links de fontes e solicitações da equipe.

## Experiência e áreas do produto

1. Entrada e criação/seleção de organização; criação/seleção de equipe e convites.
2. Início da equipe: campo para descrever uma dúvida ou tarefa, conversas recentes e acesso à base.
3. Base de conhecimento: envio e listagem, status, falhas, download autorizado e exclusão.
4. Assistente: resposta, referências verificáveis, orientação guiada e preparação de solicitação.
5. Solicitações: lista, detalhes, responsável, comentários e estado.
6. Configurações: membros, papéis e nome da organização/equipe conforme permissões.

A navegação mostra apenas as áreas entregues, sem páginas decorativas de relatórios ou integrações.

## Documentos e busca

Formatos iniciais: PDF com texto, DOCX e TXT. Proposta: limite de 20 MB por arquivo, validado no servidor junto com formato e conteúdo; arquivos inválidos e PDFs sem texto recebem mensagem acionável. Não executar conteúdo dos arquivos.

Fluxo: validar envio e acesso, armazenar objeto privado, registrar documento pendente, enfileirar extração, dividir texto preservando referência, gerar embeddings e disponibilizar busca somente após sucesso completo. Estados: pendente, processando, pronto, falhou. Gestor pode repetir processamento com falha. Trabalho idempotente com tentativas limitadas e registro de erro sem expor conteúdo ou credenciais.

PDF guarda número da página; DOCX e TXT usam seção/parágrafo ou trecho, sem inventar paginação. Fonte inclui documento e localização e permite conferir o trecho. Primeira versão permite excluir e reenviar; não oferece versionamento. Excluir remove o documento da busca imediatamente e agenda remoção do arquivo e derivados. Respostas antigas não continuam servindo o conteúdo excluído como fonte acessível: a referência aparece indisponível; o texto de resposta previamente gerado pode permanecer no histórico privado, com esse limite explicitado na interface.

Busca recebe o contexto autorizado da equipe no servidor, recupera trechos e gera resposta com referências a esses trechos. IDs de citação devolvidos pelo modelo são validados. Documentos e mensagens são dados não confiáveis, nunca instruções de sistema; o modelo não recebe ferramentas para alterar permissões, buscar em outra equipe ou executar comandos.

## Orientação e encaminhamento

Uma conversa contém mensagens e, quando aplicável, uma sessão guiada com passos e resultados persistidos. O usuário confirma se um passo funcionou, falhou ou não pôde ser realizado. Próximo passo depende desse resultado e das fontes disponíveis. Procedimentos sensíveis não são executados automaticamente.

Se faltarem evidências ou o usuário pedir ajuda humana, o assistente prepara um resumo editável: problema, contexto informado, passos e resultados, fontes e lacunas. Apenas a confirmação explícita cria a solicitação. Não incluir a conversa inteira por padrão. Não pedir senhas, tokens ou outros segredos como contexto.

Solicitação pertence à equipe, começa aberta e sem responsável; gestor pode atribuir a si ou a outro gestor da mesma equipe. Estados: aberta, em atendimento, resolvida, encerrada. Autor pode comentar, confirmar resolução, encerrar ou reabrir; gestor pode comentar e alterar estados. Resolvida indica solução proposta, encerrada indica conclusão confirmada pelo autor. Sem email de notificação ou integração com helpdesk nesta versão; acompanhamento dentro do produto.

## Estrutura e serviços

Proposta técnica do responsável pela implementação, ainda não escolhida pelo usuário: TypeScript no Next.js, PostgreSQL com pgvector para dados e trechos, armazenamento privado compatível com S3 e fila persistente em PostgreSQL para evitar outro serviço de dados. Reutilizar bibliotecas mantidas para autenticação e leitura de arquivos, sem implementar criptografia ou parsing de formatos complexos manualmente.

Entidades: usuário, organização, participação na organização, equipe, participação na equipe, convite, documento, trecho, trabalho de ingestão, conversa, mensagem, sessão/passos guiados, solicitação e comentário. Conteúdo tem vínculo explícito com organização e equipe; operações conferem consistência desses vínculos. Migrações e configuração documentada fazem parte da entrega.

Modelo de linguagem e embeddings são serviços externos configurados no servidor. Credenciais nunca chegam ao navegador. Enviar somente os trechos necessários e avisar ao responsável pela organização que conteúdo será processado pelo provedor configurado. Provedor, modelo, autenticação, hospedagem e bibliotecas exatas serão definidos na implementação com documentação atual; não se assume contratação ou implantação autorizada.

Limites de requisição por usuário, limites de geração e tratamento de indisponibilidade protegem custo e experiência. Registrar IDs, duração, consumo e erros, evitando texto dos documentos e conversas nos logs. Auditoria mínima de convites, mudanças de acesso e exclusão de documentos. Respostas do modelo são renderizadas com segurança, sem HTML arbitrário.

## Identidade visual

Usar SVGs da marca, base parchment/paper, texto ink, terracota para ações, oliva para evidências e ocre para atenção. A paleta v3 tem precedência visual sobre inconsistências dos tokens antigos (azul e gradiente). Referências PNG são inspiração, não telas prontas nem conteúdo factual do produto. Priorizar leitura, contraste, teclado, foco visível, estados vazios e mensagens de erro. Interface em português e uso responsivo.

## Entregas e verificação

1. Base navegável com autenticação, organizações, equipes, membros e marca.
2. Ingestão e perguntas reais com fontes, incluindo falha, repetição e exclusão.
3. Orientação persistida e solicitações completas, prontas para um piloto.

Critérios de aceite: usuário autorizado envia um documento e pergunta sobre ele; a resposta cita trecho verificável; pergunta sem apoio reconhece a lacuna; passo guiado persiste após recarregar; encaminhamento depende de confirmação e preserva os resultados escolhidos; gestor acompanha e responde; usuário de outra organização/equipe não acessa conteúdo nem por IDs diretos, busca ou fontes; falhas de processamento são visíveis e recuperáveis; exclusão e remoção de membro revogam acesso.

Testes devem focar isolamento de acesso, referências, ingestão, transições de orientação/solicitação e um percurso completo com documento pequeno de resultado conhecido. Comparar respostas com perguntas previamente revisadas; aparência plausível não é prova de qualidade.

## Decisões deixadas à implementação e riscos

Detalhes de pastas, bibliotecas, provedor de autenticação, modelos e infraestrutura são escolhas de implementação que devem preservar este desenho. Não há prazo nem orçamento fechado. Código local utilizável e instruções de configuração são parte do trabalho; credenciais reais, contratação e publicação dependem do ambiente disponível.

Riscos principais: documentação desatualizada, respostas sem apoio, exposição entre equipes, custo de modelos e retenção de conteúdo em históricos. Validar com documentos e perguntas de uma equipe antes de ampliar o uso, mantendo o produto genérico.

## Aprovação e contexto de portfólio

Desenho aprovado pelo usuário em 2026-11-05. Projeto destinado ao portfólio no GitHub, sem intenção de venda. Não incluir cobrança nem planejamento comercial. Priorizar execução local reproduzível, documentação técnica, dados fictícios e demonstração claramente identificada. Demonstração sem credenciais não substitui a integração real de IA. Manter as garantias de acesso, validação e fontes mesmo em um projeto de portfólio. Não publicar repositório ou contratar serviços sem solicitação.
