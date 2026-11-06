import type { WorkspaceData } from "./workspace";
export const demoData: WorkspaceData = {
  scope: { organizationId: "demo-org", teamId: "demo-ti" },
  user: { id: "demo-user", name: "Marina Costa", email: "marina@example.test" },
  role: "manager",
  isAdmin: true,
  organizationName: "Acme Studio",
  teamName: "Tecnologia",
  teamDescription: "Um lugar para encontrar respostas e seguir em frente.",
  teams: [
    {
      organizationId: "demo-org",
      teamId: "demo-ti",
      name: "Tecnologia",
      organizationName: "Acme Studio",
    },
    {
      organizationId: "demo-org",
      teamId: "demo-rh",
      name: "Pessoas & Cultura",
      organizationName: "Acme Studio",
    },
  ],
  documents: [
    {
      id: "doc-vpn",
      title: "Guia de acesso remoto",
      format: "pdf",
      size: 245000,
      status: "ready",
      error: null,
      createdAt: "2026-11-01",
    },
    {
      id: "doc-sec",
      title: "Política de segurança da informação",
      format: "pdf",
      size: 182000,
      status: "ready",
      error: null,
      createdAt: "2026-11-02",
    },
    {
      id: "doc-onboard",
      title: "Primeiros passos na equipe",
      format: "docx",
      size: 58000,
      status: "ready",
      error: null,
      createdAt: "2026-11-03",
    },
    {
      id: "doc-help",
      title: "Como solicitar suporte",
      format: "txt",
      size: 12000,
      status: "ready",
      error: null,
      createdAt: "2026-11-04",
    },
  ],
  conversations: [],
  requests: [
    {
      id: "KF-1024",
      title: "Acesso à pasta compartilhada",
      summary: "Exemplo fictício: acesso à pasta da equipe indisponível.",
      status: "in_progress",
      authorId: "demo-user",
      authorName: "Marina Costa",
      assigneeId: "demo-manager",
      createdAt: "2026-11-05",
      comments: [
        {
          id: "comment-1",
          author: "Rafael Lima",
          content: "Exemplo: estamos verificando suas permissões.",
        },
      ],
    },
  ],
  members: [
    {
      id: "demo-user",
      name: "Marina Costa",
      email: "marina@example.test",
      role: "manager",
    },
    {
      id: "demo-manager",
      name: "Rafael Lima",
      email: "rafael@example.test",
      role: "manager",
    },
    {
      id: "demo-member",
      name: "Ana Souza",
      email: "ana@example.test",
      role: "member",
    },
  ],
};
export function demoConversation(kind: "vpn" | "rh") {
  const source = {
    chunkId: "demo-source",
    documentId: "doc-vpn",
    title:
      kind === "vpn"
        ? "Guia de acesso remoto"
        : "Guia de solicitação de férias",
    location: kind === "vpn" ? "Página 3 · Conexão" : "Seção 2 · Solicitação",
    excerpt:
      kind === "vpn"
        ? "Conteúdo fictício para demonstração. Antes de conectar à VPN, confirme que a internet funciona acessando uma página no navegador. Se o erro persistir, anote a mensagem exibida pelo cliente e encaminhe à equipe. Nunca compartilhe sua senha."
        : "Conteúdo fictício para demonstração. Converse com a liderança sobre o período desejado. Depois, registre uma solicitação com as datas para avaliação da equipe de Pessoas & Cultura.",
  };
  return {
    id: "demo-conversation",
    title: kind === "vpn" ? "VPN não conecta" : "Como solicitar férias",
    messages: [
      {
        id: "demo-question",
        role: "user" as const,
        content:
          kind === "vpn"
            ? "Minha VPN não conecta. O que posso fazer?"
            : "Como faço para solicitar férias?",
        sources: [],
      },
      {
        id: "demo-answer",
        role: "assistant" as const,
        content:
          kind === "vpn"
            ? "Vamos verificar a conexão antes de tentar novamente. O guia de acesso remoto orienta começar pela rede e, se necessário, encaminhar a mensagem de erro à equipe."
            : "O guia da equipe orienta alinhar o período com sua liderança antes de registrar a solicitação. Vamos começar por essa etapa.",
        sources: [source],
      },
    ],
    steps: [
      {
        id: "demo-step-1",
        instruction:
          kind === "vpn"
            ? "Verifique sua conexão com a internet"
            : "Alinhe o período com sua liderança",
        result: null,
      },
    ],
  };
}
