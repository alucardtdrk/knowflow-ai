"use client";
/* eslint-disable @next/next/no-img-element */
import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import Markdown from "react-markdown";
import { createAuthClient } from "better-auth/react";
import {
  Home,
  BookOpen,
  MessagesSquare,
  Inbox,
  Settings,
  ArrowUpRight,
  ArrowRight,
  Plus,
  Search,
  ChevronDown,
  ChevronRight,
  FileText,
  ShieldCheck,
  Check,
  X,
  Send,
  Upload,
  MoreHorizontal,
  CheckCircle2,
  CircleHelp,
  ArrowLeft,
  Menu,
  LogOut,
  Users,
  FolderOpen,
  LoaderCircle,
  RefreshCw,
  Trash2,
  Download,
  ExternalLink,
  AlertCircle,
  CornerDownRight,
  LifeBuoy,
  Compass,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type {
  WorkspaceData,
  ConversationItem,
  RequestItem,
} from "@/lib/workspace";
import type { Source, RequestStatus } from "@/lib/types";
import { demoConversation } from "@/lib/demo";
import { buildRequestSummary } from "@/lib/handoff";
import {
  loadWorkspace,
  askAction,
  stepAction,
  uploadAction,
  documentAction,
  requestAction,
  updateRequestAction,
  inviteAction,
  memberAction,
  teamAction,
  organizationAction,
  joinTeamAction,
} from "@/app/actions";

type View =
  | "home"
  | "documents"
  | "conversations"
  | "requests"
  | "settings"
  | "conversation";
const nav: { id: View; label: string; icon: LucideIcon }[] = [
  { id: "home", label: "Início", icon: Home },
  { id: "documents", label: "Base de conhecimento", icon: BookOpen },
  { id: "conversations", label: "Minhas conversas", icon: MessagesSquare },
  { id: "requests", label: "Solicitações", icon: Inbox },
];
const statusLabels: Record<string, string> = {
  ready: "Disponível",
  pending: "Na fila",
  processing: "Processando",
  failed: "Falhou",
  open: "Aberta",
  in_progress: "Em atendimento",
  resolved: "Solução proposta",
  closed: "Encerrada",
};
const date = (value: string) =>
  new Date(
    value.length === 10 ? value + "T12:00:00-03:00" : value,
  ).toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "short",
    timeZone: "America/Sao_Paulo",
  });
const size = (value: number) =>
  value < 1024 * 1024
    ? `${Math.round(value / 1024)} KB`
    : `${(value / 1024 / 1024).toFixed(1)} MB`;
function Status({ value }: { value: string }) {
  return (
    <span className={`badge status-${value}`}>
      <span className="status-dot" />
      {statusLabels[value] || value}
    </span>
  );
}
function FileIcon({ format = "pdf" }: { format?: string }) {
  return (
    <span className={`file-icon file-${format}`}>
      <FileText size={20} />
      <span>{format.toUpperCase()}</span>
    </span>
  );
}
function Empty({
  icon: Icon,
  title,
  description,
}: {
  icon: LucideIcon;
  title: string;
  description: string;
}) {
  return (
    <div className="empty-state">
      <Icon size={30} />
      <h3>{title}</h3>
      <p>{description}</p>
    </div>
  );
}

export function Workspace({
  initial,
  demo = false,
}: {
  initial: WorkspaceData;
  demo?: boolean;
}) {
  const router = useRouter();
  const [data, setData] = useState(initial),
    [view, setView] = useState<View>("home"),
    [activeId, setActiveId] = useState<string | null>(null),
    [query, setQuery] = useState(""),
    [search, setSearch] = useState(""),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [notice, setNotice] = useState(""),
    [source, setSource] = useState<Source | null>(null),
    [mobile, setMobile] = useState(false),
    [requestDraft, setRequestDraft] = useState(false),
    [requestDetail, setRequestDetail] = useState<string | null>(null),
    [upload, setUpload] = useState(false),
    [deleteId, setDeleteId] = useState<string | null>(null),
    [confirmationId, setConfirmationId] = useState(""),
    [inviteLink, setInviteLink] = useState("");
  const [draftTitle, setDraftTitle] = useState(""),
    [draftSummary, setDraftSummary] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);
  const demoSpaces = useRef<Record<string, WorkspaceData>>({});
  const active = data.conversations.find((c) => c.id === activeId);
  const isRh = data.scope.teamId === "demo-rh";
  const pending = active?.steps.find((s) => s.result === null);
  async function refresh() {
    if (!demo) setData(await loadWorkspace(data.scope.teamId));
  }
  async function run(fn: () => Promise<void>) {
    setBusy(true);
    setError("");
    setNotice("");
    try {
      await fn();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Não foi possível concluir.");
    } finally {
      setBusy(false);
    }
  }
  function move(next: View) {
    setView(next);
    setMobile(false);
    setSearch("");
    setNotice("");
    setError("");
    setRequestDetail(null);
  }
  function openConversation(c: ConversationItem) {
    setActiveId(c.id);
    move("conversation");
  }
  function openDemo(kind: "vpn" | "rh") {
    const conversation = demoConversation(kind);
    setData((d) => ({
      ...d,
      conversations: [
        conversation,
        ...d.conversations.filter((c) => c.id !== conversation.id),
      ],
    }));
    setActiveId(conversation.id);
    move("conversation");
    setQuery("");
  }
  async function ask(message = query) {
    if (demo) {
      setNotice(
        "A demonstração usa exemplos preparados. Entre na aplicação para consultar seus documentos.",
      );
      return;
    }
    if (message.trim().length < 2) return;
    await run(async () => {
      const result = await askAction(data.scope, {
        message,
        conversationId:
          view === "conversation" && activeId ? activeId : undefined,
      });
      if (!result.ok) throw new Error(result.error);
      await refresh();
      setActiveId(result.data.conversationId);
      setView("conversation");
      setQuery("");
    });
  }
  async function report(result: "worked" | "failed" | "unable") {
    if (!pending) return;
    if (demo) {
      setData((d) => ({
        ...d,
        conversations: d.conversations.map((c) =>
          c.id === activeId
            ? {
                ...c,
                steps: [
                  ...c.steps.map((s) =>
                    s.id === pending.id ? { ...s, result } : s,
                  ),
                  ...(result !== "worked" && c.steps.length === 1
                    ? [
                        {
                          id: "demo-step-2",
                          instruction: isRh
                            ? "Registre o período desejado para avaliação"
                            : "Confira a mensagem de erro",
                          result: null,
                        },
                      ]
                    : []),
                ],
              }
            : c,
        ),
      }));
      setNotice(
        result === "worked"
          ? "Você confirmou que esta etapa funcionou."
          : "Resultado registrado neste exemplo.",
      );
      return;
    }
    await run(async () => {
      const r = await stepAction(data.scope, { stepId: pending.id, result });
      if (!r.ok) throw new Error(r.error);
      await refresh();
      if (result !== "worked")
        await ask(
          "A etapa anterior não resolveu ou não pôde ser realizada. Qual o próximo passo apoiado nos documentos?",
        );
      else
        setNotice(
          "Resultado registrado. Você pode continuar ou preparar um encaminhamento.",
        );
    });
  }
  function prepareRequest(blank = false) {
    const conversation = blank ? undefined : active;
    setConfirmationId(crypto.randomUUID());
    setDraftTitle(conversation?.title || "Nova solicitação");
    setDraftSummary(conversation ? buildRequestSummary(conversation) : "");
    setRequestDraft(true);
  }
  async function submitRequest() {
    await run(async () => {
      if (demo) {
        const r: RequestItem = {
          id: `KF-${1025 + data.requests.length}`,
          title: draftTitle,
          summary: draftSummary,
          status: "open",
          authorId: data.user.id,
          authorName: data.user.name,
          assigneeId: null,
          createdAt: new Date().toISOString(),
          comments: [],
        };
        setData((d) => ({ ...d, requests: [r, ...d.requests] }));
        setNotice("Solicitação de exemplo registrada");
      } else {
        const r = await requestAction(data.scope, {
          confirmationId,
          title: draftTitle,
          summary: draftSummary,
          conversationId: activeId || undefined,
          confirmed: true,
        });
        if (!r.ok) throw new Error(r.error);
        await refresh();
        setNotice(
          "Solicitação registrada. Acompanhe o atendimento nesta equipe.",
        );
      }
      setRequestDraft(false);
      setView("requests");
    });
  }
  async function updateRequest(
    id: string,
    input: {
      status?: RequestStatus;
      assigneeId?: string | null;
      comment?: string;
    },
  ) {
    await run(async () => {
      if (demo) {
        setData((d) => ({
          ...d,
          requests: d.requests.map((r) =>
            r.id === id
              ? {
                  ...r,
                  ...(input.status ? { status: input.status } : {}),
                  ...(input.assigneeId !== undefined
                    ? { assigneeId: input.assigneeId }
                    : {}),
                  comments: input.comment
                    ? [
                        ...r.comments,
                        {
                          id: crypto.randomUUID(),
                          author: data.user.name,
                          content: input.comment,
                        },
                      ]
                    : r.comments,
                }
              : r,
          ),
        }));
      } else {
        const r = await updateRequestAction(data.scope, { id, ...input });
        if (!r.ok) throw new Error(r.error);
        await refresh();
      }
    });
  }
  useEffect(() => {
    if (!source && !requestDraft && !upload && !deleteId) return;
    const handle = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setSource(null);
        setRequestDraft(false);
        setUpload(false);
        setDeleteId(null);
      }
    };
    document.addEventListener("keydown", handle);
    return () => document.removeEventListener("keydown", handle);
  }, [source, requestDraft, upload, deleteId]);
  const docs = data.documents.filter((d) =>
    d.title.toLowerCase().includes(search.toLowerCase()),
  );
  const request = data.requests.find((r) => r.id === requestDetail);
  return (
    <div className="workspace">
      <a className="skip-link" href="#main-content">
        Pular para o conteúdo
      </a>
      <aside className={`sidebar ${mobile ? "is-open" : ""}`}>
        <div className="sidebar-top">
          <Link href={demo ? "/demo" : "/app"} className="brand">
            <img src="/brand/knowflow-wordmark.svg" alt="KnowFlow AI" />
          </Link>
          <p className="brand-tagline">Conhecimento que resolve.</p>
        </div>
        <div className="organization-switch">
          <span className="org-avatar">
            {data.organizationName.slice(0, 1)}
          </span>
          <div>
            <strong>{data.organizationName}</strong>
            <span>Seu espaço de trabalho</span>
          </div>
          <ChevronDown size={14} />
        </div>
        <div className="sidebar-label">ESPAÇO DE TRABALHO</div>
        <nav aria-label="Navegação principal">
          {nav.map((n) => (
            <button
              key={n.id}
              className={`nav-item ${view === n.id || (n.id === "conversations" && view === "conversation") ? "active" : ""}`}
              onClick={() => move(n.id)}
            >
              <n.icon size={18} />
              {n.label}
              {n.id === "requests" &&
                data.requests.filter((r) => r.status !== "closed").length >
                  0 && (
                  <span className="nav-count">
                    {data.requests.filter((r) => r.status !== "closed").length}
                  </span>
                )}
            </button>
          ))}
        </nav>
        <div className="sidebar-label teams-label">
          SUAS EQUIPES{" "}
          {data.isAdmin && (
            <button aria-label="Criar equipe" onClick={() => move("settings")}>
              <Plus size={15} />
            </button>
          )}
        </div>
        <nav aria-label="Equipes">
          {data.teams.map((t) => (
            <button
              key={t.teamId}
              className={`team-item ${t.teamId === data.scope.teamId ? "selected" : ""}`}
              onClick={() => {
                if (demo) {
                  demoSpaces.current[data.scope.teamId] = data;
                  const cached = demoSpaces.current[t.teamId];
                  const rh = t.teamId === "demo-rh";
                  setData(
                    (d) =>
                      cached || {
                        ...d,
                        scope: {
                          organizationId: t.organizationId,
                          teamId: t.teamId,
                        },
                        teamName: t.name,
                        teamDescription: rh
                          ? "Orientação para cuidar de quem faz a equipe acontecer."
                          : "Um lugar para encontrar respostas e seguir em frente.",
                        conversations: [],
                        requests: rh ? [] : initial.requests,
                        documents: rh
                          ? d.documents.map((doc, i) => ({
                              ...doc,
                              title: [
                                "Guia de solicitação de férias",
                                "Manual da pessoa colaboradora",
                                "Processo de reembolso",
                                "Como falar com a equipe",
                              ][i],
                            }))
                          : initial.documents,
                      },
                  );
                  setActiveId(null);
                  move("home");
                } else router.push(`/app/${t.teamId}`);
              }}
            >
              <span
                className={`team-square ${t.teamId === data.scope.teamId ? "terracotta" : ""}`}
              >
                {t.name.slice(0, 1)}
              </span>
              <span>{t.name}</span>
              {t.teamId === data.scope.teamId && (
                <span className="selected-dot" />
              )}
            </button>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="knowledge-note">
            <BookOpen size={23} />
            <p>
              O que sua equipe sabe,
              <br />
              <strong>ao alcance de todos.</strong>
            </p>
            <span>Com as permissões certas.</span>
          </div>
          <button
            className={`nav-item ${view === "settings" ? "active" : ""}`}
            onClick={() => move("settings")}
          >
            <Settings size={18} />
            Configurações
          </button>
          <div className="user-row">
            <span className="avatar">
              {data.user.name
                .split(" ")
                .map((n) => n[0])
                .slice(0, 2)
                .join("")}
            </span>
            <div>
              <strong>{data.user.name}</strong>
              <span>
                {demo
                  ? "Perfil demonstrativo"
                  : data.role === "manager"
                    ? "Gestor da equipe"
                    : "Membro da equipe"}
              </span>
            </div>
            {demo ? (
              <Link href="/login" aria-label="Entrar na aplicação">
                <ArrowUpRight size={17} />
              </Link>
            ) : (
              <button
                aria-label="Sair da conta"
                onClick={() =>
                  createAuthClient()
                    .signOut()
                    .then(() => router.push("/login"))
                }
              >
                <LogOut size={17} />
              </button>
            )}
          </div>
        </div>
      </aside>
      {mobile && (
        <button
          className="sidebar-overlay"
          aria-label="Fechar menu"
          onClick={() => setMobile(false)}
        />
      )}
      <div className="workspace-body">
        <header className="topbar">
          <button
            className="mobile-menu icon-button"
            aria-label="Abrir menu"
            onClick={() => setMobile(!mobile)}
          >
            <Menu size={20} />
          </button>
          <div className="breadcrumb">
            <span>{data.organizationName}</span>
            <ChevronRight size={13} />
            <strong>{data.teamName}</strong>
          </div>
          <div className="topbar-right">
            <span className="private-label">
              <ShieldCheck size={14} /> Espaço da equipe
            </span>
            {demo ? (
              <Link className="topbar-login" href="/login">
                Entrar na aplicação <ArrowUpRight size={14} />
              </Link>
            ) : (
              <span className="avatar small-avatar">{data.user.name[0]}</span>
            )}
          </div>
        </header>
        {demo && (
          <div className="demo-bar">
            <span>
              <span className="demo-dot" /> Ambiente demonstrativo
            </span>
            <span>
              Dados fictícios. Explore o fluxo com exemplos preparados.
            </span>
            <Link href="/login">
              Usar meus documentos <ArrowRight size={13} />
            </Link>
          </div>
        )}
        <main id="main-content" className={`main-content view-${view}`}>
          {notice && (
            <div className="notice" role="status">
              <CheckCircle2 size={17} />
              <span>{notice}</span>
              <button
                aria-label="Dispensar aviso"
                onClick={() => setNotice("")}
              >
                <X size={15} />
              </button>
            </div>
          )}
          {error && (
            <div className="notice error" role="alert">
              <AlertCircle size={17} />
              <span>{error}</span>
              <button aria-label="Fechar erro" onClick={() => setError("")}>
                <X size={15} />
              </button>
            </div>
          )}
          {view === "home" && (
            <>
              <div className="page-kicker">
                <span className="eyebrow">SEU ASSISTENTE DE CONHECIMENTO</span>
                <span className="today">
                  {demo
                    ? "QUINTA-FEIRA, 5 DE NOVEMBRO"
                    : "CONHECIMENTO DA SUA EQUIPE"}
                </span>
              </div>
              <section className="hero">
                <div className="hero-label">
                  <span className="tiny-square" />
                  {data.teamName}
                </div>
                <h1>
                  O que você precisa
                  <br />
                  resolver <em>hoje?</em>
                </h1>
                <p>
                  O conhecimento da sua equipe, transformado em próximos passos.
                  <br className="desktop-break" /> Pergunte, encontre a fonte e
                  siga em frente.
                </p>
                <form
                  className="ask-box"
                  onSubmit={(e) => {
                    e.preventDefault();
                    void ask();
                  }}
                >
                  <div className="ask-input">
                    <Search size={23} />
                    <input
                      aria-label="Sua pergunta"
                      placeholder="Descreva sua dúvida ou o que precisa resolver..."
                      value={query}
                      onChange={(e) => setQuery(e.target.value)}
                      maxLength={4000}
                      required
                      minLength={2}
                    />
                  </div>
                  <div className="ask-bottom">
                    <span>
                      <ShieldCheck size={14} /> Respostas baseadas nos seus
                      documentos
                    </span>
                    <button
                      className="button primary"
                      disabled={busy}
                      aria-label="Buscar orientação"
                    >
                      {busy ? (
                        <LoaderCircle size={16} className="spin" />
                      ) : (
                        <ArrowRight size={17} />
                      )}
                      Buscar orientação
                    </button>
                  </div>
                </form>
                <div className="suggestions">
                  <span>Comece por aqui</span>
                  {(isRh
                    ? ["Como solicitar férias", "Como funciona o reembolso?"]
                    : ["Minha VPN não conecta", "Como solicitar um acesso?"]
                  ).map((q, i) => (
                    <button
                      key={q}
                      onClick={() =>
                        demo ? openDemo(isRh ? "rh" : "vpn") : void ask(q)
                      }
                    >
                      {i === 0 ? (
                        <Compass size={13} />
                      ) : (
                        <CircleHelp size={13} />
                      )}{" "}
                      {q}
                      <ArrowUpRight size={12} />
                    </button>
                  ))}
                </div>
              </section>
              <section className="how-row" aria-label="Como funciona">
                <div>
                  <span className="step-number">01</span>
                  <div>
                    <strong>Descreva o que precisa</strong>
                    <p>Uma dúvida, um problema, um próximo passo.</p>
                  </div>
                </div>
                <ChevronRight className="how-arrow" size={17} />
                <div>
                  <span className="step-number">02</span>
                  <div>
                    <strong>Encontre orientação com fontes</strong>
                    <p>Conhecimento da equipe, com contexto.</p>
                  </div>
                </div>
                <ChevronRight className="how-arrow" size={17} />
                <div>
                  <span className="step-number">03</span>
                  <div>
                    <strong>Resolva ou encaminhe</strong>
                    <p>Continue com clareza. Conte com pessoas.</p>
                  </div>
                </div>
              </section>
              <div className="home-grid">
                <section className="panel documents-panel">
                  <div className="section-heading">
                    <div>
                      <span className="eyebrow">
                        O CONHECIMENTO COMEÇA AQUI
                      </span>
                      <h2>Na base da sua equipe</h2>
                    </div>
                    <button
                      className="text-link"
                      onClick={() => move("documents")}
                    >
                      Ver todos <ArrowUpRight size={14} />
                    </button>
                  </div>
                  {data.documents.length ? (
                    <div className="document-preview">
                      {data.documents.slice(0, 3).map((d) => (
                        <button
                          className="document-row"
                          key={d.id}
                          onClick={() => move("documents")}
                        >
                          <FileIcon format={d.format} />
                          <span className="document-info">
                            <strong>{d.title}</strong>
                            <span>
                              {d.format.toUpperCase()}
                              <i /> {size(d.size)}
                            </span>
                          </span>
                          <Status value={d.status} />
                          <ChevronRight size={15} />
                        </button>
                      ))}
                    </div>
                  ) : (
                    <Empty
                      icon={BookOpen}
                      title="Seu conhecimento começa aqui"
                      description="Adicione os primeiros documentos para dar contexto ao assistente."
                    />
                  )}
                  <div className="panel-foot">
                    <ShieldCheck size={14} /> Disponível apenas para membros
                    desta equipe
                  </div>
                </section>
                <section className="getting-started">
                  <div className="getting-icon">
                    <CornerDownRight size={26} />
                  </div>
                  <span className="eyebrow">DO DOCUMENTO À AÇÃO</span>
                  <h2>
                    Uma boa resposta
                    <br />é só o começo.
                  </h2>
                  <p>
                    O KnowFlow acompanha cada etapa. Se precisar de uma pessoa,
                    o contexto vai junto.
                  </p>
                  <button
                    className="text-link"
                    onClick={() =>
                      demo ? openDemo(isRh ? "rh" : "vpn") : prepareRequest()
                    }
                  >
                    Veja como funciona <ArrowRight size={16} />
                  </button>
                  <div className="mini-flow">
                    <span>
                      <FileText size={16} />
                    </span>
                    <i />
                    <span>
                      <MessagesSquare size={16} />
                    </span>
                    <i />
                    <span>
                      <Check size={16} />
                    </span>
                  </div>
                </section>
              </div>
              <section className="activity-section">
                <div className="section-heading">
                  <h2>Continue de onde parou</h2>
                  <button
                    className="text-link"
                    onClick={() => move("conversations")}
                  >
                    Minhas conversas <ArrowUpRight size={14} />
                  </button>
                </div>
                {data.conversations.length ? (
                  <div className="recent-grid">
                    {data.conversations.slice(0, 3).map((c) => (
                      <button
                        className="recent-card"
                        key={c.id}
                        onClick={() => openConversation(c)}
                      >
                        <MessagesSquare size={18} />
                        <strong>{c.title}</strong>
                        <ArrowUpRight size={15} />
                      </button>
                    ))}
                  </div>
                ) : (
                  <p className="quiet-empty">
                    Suas conversas aparecerão aqui. Um bom próximo passo começa
                    com uma pergunta.
                  </p>
                )}
              </section>
            </>
          )}
          {view === "documents" && (
            <>
              <PageHeading
                eyebrow="BASE DE CONHECIMENTO"
                title="O que sua equipe sabe."
                description="Documentos que dão contexto a cada resposta e orientação."
                action={
                  data.role === "manager" ? (
                    <button
                      className="button primary"
                      onClick={() => {
                        if (demo) {
                          setNotice(
                            "O envio real de documentos está disponível na aplicação. Estes arquivos são exemplos fictícios.",
                          );
                          return;
                        }
                        setUpload(true);
                      }}
                    >
                      <Plus size={17} />
                      Adicionar documento
                    </button>
                  ) : undefined
                }
              />
              <div className="stats-strip">
                <span>
                  <strong>{data.documents.length}</strong> documentos
                </span>
                <span>
                  <span className="status-dot olive" />
                  {
                    data.documents.filter((d) => d.status === "ready").length
                  }{" "}
                  disponíveis para consulta
                </span>
                <span>
                  <ShieldCheck size={14} />
                  Acesso restrito à equipe
                </span>
              </div>
              <div className="panel">
                <div className="table-toolbar">
                  <label className="search-field">
                    <Search size={17} />
                    <input
                      aria-label="Buscar documento"
                      placeholder="Buscar por nome do documento..."
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                    />
                  </label>
                  {!demo && (
                    <button
                      className="button subtle"
                      disabled={busy}
                      onClick={() => void run(refresh)}
                    >
                      <RefreshCw size={15} />
                      Atualizar status
                    </button>
                  )}
                </div>
                {docs.length ? (
                  <div className="table-scroll">
                    <table>
                      <thead>
                        <tr>
                          <th>Documento</th>
                          <th>Status</th>
                          <th>Adicionado em</th>
                          <th>
                            <span className="sr-only">Ações</span>
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {docs.map((d) => (
                          <tr key={d.id}>
                            <td>
                              <div className="table-document">
                                <FileIcon format={d.format} />
                                <div>
                                  <strong>{d.title}</strong>
                                  <span>
                                    {d.format.toUpperCase()} · {size(d.size)}
                                  </span>
                                  {d.error && (
                                    <span className="error-text">
                                      {d.error}
                                    </span>
                                  )}
                                </div>
                              </div>
                            </td>
                            <td>
                              <Status value={d.status} />
                            </td>
                            <td className="muted small">{date(d.createdAt)}</td>
                            <td>
                              <div className="table-actions">
                                {demo ? (
                                  <button
                                    className="icon-button"
                                    aria-label={`Ver exemplo: ${d.title}`}
                                    onClick={() =>
                                      setSource({
                                        chunkId: "demo",
                                        documentId: d.id,
                                        title: d.title,
                                        location: "Exemplo de documento",
                                        excerpt:
                                          "Conteúdo fictício para demonstração. Na aplicação, você pode enviar documentos reais e conferir os trechos utilizados em cada resposta.",
                                      })
                                    }
                                  >
                                    <ExternalLink size={16} />
                                  </button>
                                ) : (
                                  <>
                                    <a
                                      className="icon-button"
                                      aria-label={`Baixar ${d.title}`}
                                      href={`/api/documents/${d.id}?organizationId=${data.scope.organizationId}&teamId=${data.scope.teamId}`}
                                    >
                                      <Download size={16} />
                                    </a>
                                    {data.role === "manager" && (
                                      <>
                                        {d.status === "failed" && (
                                          <button
                                            className="icon-button"
                                            disabled={busy}
                                            aria-label={`Reprocessar ${d.title}`}
                                            onClick={() =>
                                              void run(async () => {
                                                const r = await documentAction(
                                                  data.scope,
                                                  d.id,
                                                  "retry",
                                                );
                                                if (!r.ok)
                                                  throw new Error(r.error);
                                                await refresh();
                                              })
                                            }
                                          >
                                            <RefreshCw size={16} />
                                          </button>
                                        )}
                                        <button
                                          className="icon-button"
                                          aria-label={`Excluir ${d.title}`}
                                          onClick={() => setDeleteId(d.id)}
                                        >
                                          <Trash2 size={16} />
                                        </button>
                                      </>
                                    )}
                                  </>
                                )}
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <Empty
                    icon={FolderOpen}
                    title="Nenhum documento por aqui"
                    description="Adicione um PDF com texto, DOCX ou TXT para começar."
                  />
                )}
                <div className="panel-foot">
                  <CircleHelp size={14} /> PDF com texto, DOCX e TXT · Até 20 MB
                  por arquivo · PDFs digitalizados precisam de OCR prévio.
                </div>
              </div>
            </>
          )}
          {view === "conversations" && (
            <>
              <PageHeading
                eyebrow="SEU HISTÓRICO"
                title="Uma pergunta leva adiante."
                description="Suas conversas são privadas. Retome uma orientação quando precisar."
                action={
                  <button
                    className="button primary"
                    onClick={() => {
                      setActiveId(null);
                      move("home");
                    }}
                  >
                    <Plus size={17} />
                    Nova conversa
                  </button>
                }
              />
              <div className="conversation-list">
                {data.conversations.length ? (
                  data.conversations.map((c) => (
                    <button
                      className="conversation-list-item"
                      key={c.id}
                      onClick={() => openConversation(c)}
                    >
                      <span className="round-icon">
                        <MessagesSquare size={20} />
                      </span>
                      <div>
                        <h3>{c.title}</h3>
                        <p>{c.messages.at(-1)?.content.slice(0, 120)}</p>
                      </div>
                      <ArrowUpRight size={18} />
                    </button>
                  ))
                ) : (
                  <Empty
                    icon={MessagesSquare}
                    title="Sua próxima pergunta começa uma conversa"
                    description="Vá ao início e descreva uma dúvida ou explore um exemplo."
                  />
                )}
              </div>
            </>
          )}
          {view === "conversation" && active && (
            <>
              <button
                className="text-link back-link"
                onClick={() => move("conversations")}
              >
                <ArrowLeft size={15} />
                Minhas conversas
              </button>
              <div className="conversation-heading">
                <div>
                  <span className="eyebrow">ORIENTAÇÃO COM CONTEXTO</span>
                  <h1>{active.title}</h1>
                </div>
                <span className="private-label">
                  <ShieldCheck size={14} />
                  {demo ? "Exemplo preparado" : "Conversa privada"}
                </span>
              </div>
              <div className="conversation-layout">
                <section className="conversation-main">
                  {active.messages.map((m) => (
                    <article key={m.id} className={`message message-${m.role}`}>
                      <div className="message-author">
                        {m.role === "assistant" ? (
                          <img src="/brand/knowflow-symbol.svg" alt="" />
                        ) : (
                          <span className="avatar small-avatar">
                            {data.user.name[0]}
                          </span>
                        )}
                        <strong>
                          {m.role === "assistant" ? "KnowFlow AI" : "Você"}
                        </strong>
                        {m.role === "assistant" && (
                          <span className="generated-label">
                            {demo
                              ? "Resposta de exemplo"
                              : "Com base nos documentos"}
                          </span>
                        )}
                      </div>
                      <div className="prose">
                        <Markdown>{m.content}</Markdown>
                      </div>
                      {m.sources.length > 0 && (
                        <div className="message-citations">
                          {m.sources.map((s, i) => (
                            <button
                              key={s.chunkId}
                              onClick={() => setSource(s)}
                              aria-label={`Ver fonte: ${s.title}`}
                            >
                              <BookOpen size={13} />
                              {i + 1}. {s.title}
                              <ArrowUpRight size={12} />
                            </button>
                          ))}
                        </div>
                      )}
                      {!!m.unavailableCount && (
                        <p className="small muted">
                          Uma ou mais fontes foram excluídas e não estão
                          disponíveis. O texto desta resposta foi preservado no
                          histórico.
                        </p>
                      )}
                    </article>
                  ))}
                  {active.steps.length > 0 && (
                    <div className="guided-card">
                      <div className="guided-header">
                        <span className="eyebrow">UM PASSO DE CADA VEZ</span>
                        <span className="badge">Orientação guiada</span>
                      </div>
                      {active.steps.map((s, i) => (
                        <div
                          key={s.id}
                          className={`guided-step ${s.result ? "completed" : ""}`}
                        >
                          <span className="guided-number">
                            {s.result ? <Check size={17} /> : i + 1}
                          </span>
                          <div>
                            <h3>{s.instruction}</h3>
                            {demo && i === 0 && (
                              <p>
                                {isRh
                                  ? "Converse sobre as datas desejadas antes de registrar o pedido."
                                  : "Abra uma página no navegador e confirme se ela carrega normalmente."}
                              </p>
                            )}
                            {s.result ? (
                              <span className="small muted">
                                Resultado informado:{" "}
                                {s.result === "worked"
                                  ? "funcionou"
                                  : s.result === "failed"
                                    ? "não resolveu"
                                    : "não foi possível realizar"}
                              </span>
                            ) : (
                              <>
                                <p className="small muted">
                                  Faça a verificação e conte o resultado para
                                  continuar.
                                </p>
                                <div className="step-actions">
                                  <button
                                    className="button secondary"
                                    disabled={busy}
                                    onClick={() => void report("worked")}
                                  >
                                    <Check size={15} />
                                    Funcionou
                                  </button>
                                  <button
                                    className="button subtle"
                                    disabled={busy}
                                    onClick={() => void report("failed")}
                                  >
                                    Não resolveu
                                  </button>
                                  <button
                                    className="text-link small"
                                    disabled={busy}
                                    onClick={() => void report("unable")}
                                  >
                                    Não consegui realizar
                                  </button>
                                </div>
                              </>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                  <div className="escalation">
                    <LifeBuoy size={22} />
                    <div>
                      <strong>Precisa de uma pessoa?</strong>
                      <p>Encaminhe o problema e o que você já tentou.</p>
                    </div>
                    <button
                      className="button secondary"
                      onClick={() => prepareRequest()}
                    >
                      Preparar solicitação <ArrowUpRight size={15} />
                    </button>
                  </div>
                  <form
                    className="followup"
                    onSubmit={(e) => {
                      e.preventDefault();
                      void ask();
                    }}
                  >
                    <input
                      aria-label="Continuar conversa"
                      placeholder={
                        pending
                          ? "Informe o resultado da etapa para continuar"
                          : "Acrescente contexto ou faça outra pergunta..."
                      }
                      value={query}
                      onChange={(e) => setQuery(e.target.value)}
                      disabled={!!pending || busy}
                      minLength={2}
                      maxLength={4000}
                      required
                    />
                    <button
                      className="icon-button"
                      aria-label="Enviar mensagem"
                      disabled={!!pending || busy}
                    >
                      {busy ? (
                        <LoaderCircle className="spin" size={20} />
                      ) : (
                        <Send size={20} />
                      )}
                    </button>
                  </form>
                </section>
                <aside className="evidence-panel">
                  <span className="eyebrow">DE ONDE VEM A ORIENTAÇÃO</span>
                  <h2>
                    Conhecimento
                    <br />
                    com referência.
                  </h2>
                  <p>
                    Cada fonte ajuda você a conferir o que sustenta a resposta.
                  </p>
                  {Array.from(
                    new Map(
                      active.messages
                        .flatMap((m) => m.sources)
                        .map((s) => [s.chunkId, s]),
                    ).values(),
                  ).map((s) => (
                    <button
                      className="source-card"
                      key={s.chunkId}
                      onClick={() => setSource(s)}
                    >
                      <FileText size={21} />
                      <div>
                        <strong>{s.title}</strong>
                        <span>{s.location}</span>
                      </div>
                      <ArrowUpRight size={15} />
                    </button>
                  ))}
                  <div className="evidence-note">
                    <ShieldCheck size={18} />
                    <p>
                      {demo
                        ? "Este fluxo usa documentos e respostas fictícios."
                        : "Somente documentos desta equipe são consultados. Se faltar evidência, vamos dizer."}
                    </p>
                  </div>
                </aside>
              </div>
            </>
          )}
          {view === "requests" && (
            <>
              <PageHeading
                eyebrow="DO CONTEXTO À RESOLUÇÃO"
                title="Nenhum problema fica solto."
                description="Orientação e atendimento humano, com o contexto no mesmo lugar."
                action={
                  <button
                    className="button primary"
                    onClick={() => {
                      setActiveId(null);
                      prepareRequest(true);
                    }}
                  >
                    <Plus size={17} />
                    Nova solicitação
                  </button>
                }
              />
              {request ? (
                <section className="panel request-detail">
                  <button
                    className="text-link"
                    onClick={() => setRequestDetail(null)}
                  >
                    <ArrowLeft size={15} />
                    Todas as solicitações
                  </button>
                  <div className="request-title">
                    <span className="mono muted">
                      {request.id.slice(0, 8).toUpperCase()}
                    </span>
                    <Status value={request.status} />
                  </div>
                  <h2>{request.title}</h2>
                  <p className="request-summary">{request.summary}</p>
                  <div className="request-meta">
                    <span>
                      Aberta por <strong>{request.authorName}</strong>
                    </span>
                    <span>{date(request.createdAt)}</span>
                  </div>
                  <div className="request-controls">
                    <label>
                      Status
                      <select
                        aria-label="Status"
                        disabled={busy}
                        value={request.status}
                        onChange={(e) =>
                          void updateRequest(request.id, {
                            status: e.target.value as RequestStatus,
                          })
                        }
                      >
                        {Object.entries(statusLabels)
                          .filter(([key]) =>
                            [
                              "open",
                              "in_progress",
                              "resolved",
                              "closed",
                            ].includes(key),
                          )
                          .map(([key, label]) => (
                            <option
                              key={key}
                              value={key}
                              disabled={
                                key === "open" || key === "closed"
                                  ? request.authorId !== data.user.id
                                  : data.role !== "manager"
                              }
                            >
                              {label}
                            </option>
                          ))}
                      </select>
                    </label>
                    {data.role === "manager" && (
                      <label>
                        Responsável
                        <select
                          aria-label="Responsável"
                          value={request.assigneeId || ""}
                          disabled={busy}
                          onChange={(e) =>
                            void updateRequest(request.id, {
                              assigneeId: e.target.value || null,
                            })
                          }
                        >
                          <option value="">Sem responsável</option>
                          {data.members
                            .filter((m) => m.role === "manager")
                            .map((m) => (
                              <option value={m.id} key={m.id}>
                                {m.name}
                              </option>
                            ))}
                        </select>
                      </label>
                    )}
                  </div>
                  <div className="comments">
                    <h3>Acompanhamento</h3>
                    {request.comments.map((c) => (
                      <article key={c.id}>
                        <strong>{c.author}</strong>
                        <p>{c.content}</p>
                      </article>
                    ))}
                    <form
                      onSubmit={(e) => {
                        e.preventDefault();
                        const f = new FormData(e.currentTarget);
                        const form = e.currentTarget;
                        void updateRequest(request.id, {
                          comment: String(f.get("comment")),
                        }).then(() => form.reset());
                      }}
                    >
                      <label>
                        Adicionar comentário
                        <textarea
                          name="comment"
                          placeholder="Compartilhe uma atualização..."
                          required
                          maxLength={4000}
                        />
                      </label>
                      <button className="button secondary" disabled={busy}>
                        Enviar comentário <Send size={15} />
                      </button>
                    </form>
                  </div>
                </section>
              ) : (
                <div className="panel">
                  {data.requests.length ? (
                    <div className="request-list">
                      {data.requests.map((r) => (
                        <button
                          key={r.id}
                          className="request-row"
                          onClick={() => setRequestDetail(r.id)}
                        >
                          <span className="request-id">
                            {r.id.slice(0, 7).toUpperCase()}
                          </span>
                          <div>
                            <strong>{r.title}</strong>
                            <span>
                              {r.authorName} · {date(r.createdAt)}
                            </span>
                          </div>
                          <Status value={r.status} />
                          <ChevronRight size={17} />
                        </button>
                      ))}
                    </div>
                  ) : (
                    <Empty
                      icon={Inbox}
                      title="Tudo em dia por aqui"
                      description="Quando precisar de atendimento humano, prepare uma solicitação com contexto."
                    />
                  )}
                </div>
              )}
            </>
          )}
          {view === "settings" && (
            <>
              <PageHeading
                eyebrow="SEU ESPAÇO, BEM ORGANIZADO"
                title="Pessoas e permissões."
                description="Conhecimento compartilhado com quem precisa ter acesso."
              />
              <div className="settings-grid">
                <section className="panel settings-section">
                  <div className="section-heading">
                    <h2>{data.teamName}</h2>
                    <span className="badge">
                      <Users size={13} />
                      {data.members.length} pessoas
                    </span>
                  </div>
                  {data.members.map((m) => (
                    <div className="member-row" key={m.id}>
                      <span className="avatar">
                        {m.name
                          .split(" ")
                          .map((n) => n[0])
                          .slice(0, 2)
                          .join("")}
                      </span>
                      <div>
                        <strong>{m.name}</strong>
                        <span>{m.email}</span>
                      </div>
                      <span className="badge">
                        {m.role === "manager" ? "Gestor" : "Membro"}
                      </span>
                      {!demo && data.role === "manager" && (
                        <details className="member-menu">
                          <summary aria-label={`Gerenciar ${m.name}`}>
                            <MoreHorizontal size={17} />
                          </summary>
                          <button
                            disabled={busy}
                            onClick={() =>
                              void run(async () => {
                                const r = await memberAction(
                                  data.scope,
                                  m.id,
                                  m.role === "manager" ? "member" : "manager",
                                );
                                if (!r.ok) throw new Error(r.error);
                                await refresh();
                              })
                            }
                          >
                            {m.role === "manager"
                              ? "Tornar membro"
                              : "Tornar gestor"}
                          </button>
                          <button
                            disabled={busy}
                            onClick={() =>
                              void run(async () => {
                                const r = await memberAction(
                                  data.scope,
                                  m.id,
                                  "remove",
                                );
                                if (!r.ok) throw new Error(r.error);
                                if (m.id === data.user.id) router.push("/app");
                                else await refresh();
                              })
                            }
                          >
                            Remover da equipe
                          </button>
                        </details>
                      )}
                    </div>
                  ))}
                  {data.role === "manager" && (
                    <form
                      className="settings-form"
                      onSubmit={(e) => {
                        e.preventDefault();
                        if (demo) {
                          setNotice(
                            "Convites reais estão disponíveis na aplicação.",
                          );
                          return;
                        }
                        const f = new FormData(e.currentTarget);
                        void run(async () => {
                          const r = await inviteAction(
                            data.scope,
                            String(f.get("email")),
                            f.get("role") as "member" | "manager",
                          );
                          if (!r.ok) throw new Error(r.error);
                          setInviteLink(r.data);
                        });
                      }}
                    >
                      <h3>Convide alguém para esta equipe</h3>
                      <label>
                        Email
                        <input
                          name="email"
                          type="email"
                          required
                          placeholder="pessoa@equipe.com"
                        />
                      </label>
                      <label>
                        Papel
                        <select name="role">
                          <option value="member">
                            Membro — consulta e solicitações próprias
                          </option>
                          <option value="manager">
                            Gestor — documentos, pessoas e atendimento
                          </option>
                        </select>
                      </label>
                      <button className="button secondary" disabled={busy}>
                        <Plus size={15} />
                        Gerar convite
                      </button>
                      {inviteLink && (
                        <label>
                          Link de convite · válido por 7 dias
                          <input
                            readOnly
                            value={inviteLink}
                            onFocus={(e) => e.target.select()}
                          />
                          <span className="small muted">
                            Copie e compartilhe com o destinatário. Ele precisa
                            entrar com o email informado.
                          </span>
                        </label>
                      )}
                    </form>
                  )}
                </section>
                <aside>
                  {data.isAdmin && !!data.organizationTeams?.length && (
                    <section className="panel settings-section">
                      <h3>Equipes da organização</h3>
                      <p className="small muted">
                        Entrar concede acesso ao conteúdo e fica registrado na
                        auditoria.
                      </p>
                      {data.organizationTeams.map((team) => (
                        <div className="member-row" key={team.id}>
                          <div>
                            <strong>{team.name}</strong>
                          </div>
                          {team.joined ? (
                            <span className="badge">Você participa</span>
                          ) : (
                            <button
                              className="button secondary"
                              disabled={busy}
                              onClick={() =>
                                void run(async () => {
                                  const r = await joinTeamAction({
                                    ...data.scope,
                                    teamId: team.id,
                                  });
                                  if (!r.ok) throw new Error(r.error);
                                  router.push(`/app/${team.id}`);
                                })
                              }
                            >
                              Entrar na equipe
                            </button>
                          )}
                        </div>
                      ))}
                    </section>
                  )}
                  <section className="permissions-note">
                    <ShieldCheck size={26} />
                    <h2>Um espaço da equipe.</h2>
                    <p>
                      Documentos são compartilhados entre os membros. Conversas
                      ficam privadas; só o resumo confirmado segue para o
                      atendimento.
                    </p>
                    <p>
                      Administradores gerenciam a organização, mas precisam
                      participar da equipe para consultar seu conteúdo.
                    </p>
                  </section>
                  {data.isAdmin && (
                    <section className="panel settings-section">
                      <h3>Criar equipe</h3>
                      <form
                        onSubmit={(e) => {
                          e.preventDefault();
                          if (demo) {
                            setNotice(
                              "Crie sua organização na aplicação para adicionar equipes.",
                            );
                            return;
                          }
                          const f = new FormData(e.currentTarget);
                          void run(async () => {
                            const r = await teamAction(
                              data.scope.organizationId,
                              String(f.get("name")),
                              String(f.get("description")),
                            );
                            if (!r.ok) throw new Error(r.error);
                            router.push(`/app/${r.data.teamId}`);
                          });
                        }}
                      >
                        <label>
                          Nome
                          <input
                            name="name"
                            required
                            minLength={2}
                            maxLength={80}
                            placeholder="Ex.: Operações"
                          />
                        </label>
                        <label>
                          Descrição
                          <input
                            name="description"
                            maxLength={240}
                            placeholder="O que esta equipe resolve?"
                          />
                        </label>
                        <button className="button secondary" disabled={busy}>
                          Criar espaço <Plus size={15} />
                        </button>
                      </form>
                    </section>
                  )}
                  <section className="panel settings-section">
                    <h3>Nova organização</h3>
                    <form
                      onSubmit={(e) => {
                        e.preventDefault();
                        if (demo) {
                          setNotice(
                            "Entre na aplicação para criar uma organização.",
                          );
                          return;
                        }
                        const f = new FormData(e.currentTarget);
                        void run(async () => {
                          const r = await organizationAction(
                            String(f.get("name")),
                          );
                          if (!r.ok) throw new Error(r.error);
                          router.push(`/app/${r.data.teamId}`);
                        });
                      }}
                    >
                      <label>
                        Nome
                        <input
                          name="name"
                          required
                          minLength={2}
                          maxLength={80}
                          placeholder="Nome da organização"
                        />
                      </label>
                      <button className="button subtle" disabled={busy}>
                        Criar organização <Plus size={15} />
                      </button>
                    </form>
                  </section>
                </aside>
              </div>
            </>
          )}
          <footer className="main-footer">
            <span>
              KnowFlow AI <i /> Conhecimento que resolve.
            </span>
            <span>
              <ShieldCheck size={13} />
              {demo
                ? "Projeto de portfólio · Dados fictícios"
                : "Seu conhecimento, no contexto certo"}
            </span>
          </footer>
        </main>
      </div>
      {source && (
        <Modal
          title="Fonte consultada"
          onClose={() => setSource(null)}
          closeLabel="Fechar fonte"
        >
          <span className="eyebrow">CONFIRA A EVIDÊNCIA</span>
          <h2>{source.title}</h2>
          <span className="badge">
            <BookOpen size={13} />
            {source.location}
          </span>
          <blockquote className="source-excerpt">{source.excerpt}</blockquote>
          <p className="small muted">
            {demo
              ? "Documento fictício, preparado para demonstrar a experiência."
              : "Trecho recuperado do documento da sua equipe. Confira o contexto antes de agir."}
          </p>
        </Modal>
      )}
      {requestDraft && (
        <Modal
          title="Preparar solicitação"
          onClose={() => setRequestDraft(false)}
        >
          {error && (
            <p className="error-text" role="alert">
              {error}
            </p>
          )}
          <span className="eyebrow">CONTEXTO QUE SEGUE JUNTO</span>
          <h2>Vamos chamar sua equipe.</h2>
          <p className="muted">
            Revise o que será compartilhado. Sua conversa completa continua
            privada.
          </p>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void submitRequest();
            }}
          >
            <label>
              Título
              <input
                required
                minLength={3}
                maxLength={120}
                value={draftTitle}
                onChange={(e) => setDraftTitle(e.target.value)}
              />
            </label>
            <label>
              Resumo para a equipe
              <textarea
                required
                minLength={10}
                maxLength={8000}
                rows={8}
                value={draftSummary}
                onChange={(e) => setDraftSummary(e.target.value)}
              />
            </label>
            <p className="small muted">
              <ShieldCheck size={13} /> Não inclua senhas, tokens ou outros
              segredos.
            </p>
            <button className="button primary full" disabled={busy}>
              {busy ? (
                <LoaderCircle className="spin" size={16} />
              ) : (
                <Send size={16} />
              )}{" "}
              {demo
                ? "Confirmar solicitação de exemplo"
                : "Confirmar e criar solicitação"}
            </button>
          </form>
        </Modal>
      )}
      {upload && (
        <Modal title="Adicionar documento" onClose={() => setUpload(false)}>
          {error && (
            <p className="error-text" role="alert">
              {error}
            </p>
          )}
          <span className="eyebrow">UM NOVO PONTO DE PARTIDA</span>
          <h2>Compartilhe conhecimento.</h2>
          <p className="muted">
            O arquivo ficará disponível para os membros desta equipe. Seu
            conteúdo será processado pelo provedor de IA configurado.
          </p>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              const f = new FormData(e.currentTarget);
              void run(async () => {
                const r = await uploadAction(data.scope, f);
                if (!r.ok) throw new Error(r.error);
                await refresh();
                setUpload(false);
                setNotice(
                  "Arquivo enviado. O processamento acontece em segundo plano. Atualize o status para acompanhar.",
                );
              });
            }}
          >
            <label className="upload-zone">
              <Upload size={30} />
              <strong>Escolha um documento</strong>
              <span>PDF com texto, DOCX ou TXT · Até 20 MB</span>
              <input
                ref={fileRef}
                name="file"
                type="file"
                accept=".pdf,.docx,.txt"
                required
              />
            </label>
            <button className="button primary full" disabled={busy}>
              {busy ? "Enviando…" : "Enviar para a base"}
            </button>
          </form>
        </Modal>
      )}
      {deleteId && (
        <Modal title="Excluir documento" onClose={() => setDeleteId(null)}>
          {error && (
            <p className="error-text" role="alert">
              {error}
            </p>
          )}
          <h2>Excluir este documento?</h2>
          <p>
            Ele deixará de ser consultado imediatamente. Respostas já geradas
            podem permanecer no histórico privado, com a fonte indicada como
            indisponível.
          </p>
          <button
            className="button danger full"
            disabled={busy}
            onClick={() =>
              void run(async () => {
                const r = await documentAction(data.scope, deleteId, "delete");
                if (!r.ok) throw new Error(r.error);
                await refresh();
                setDeleteId(null);
              })
            }
          >
            Confirmar exclusão
          </button>
        </Modal>
      )}
    </div>
  );
}
function PageHeading({
  eyebrow,
  title,
  description,
  action,
}: {
  eyebrow: string;
  title: string;
  description: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="page-heading">
      <div>
        <span className="eyebrow">{eyebrow}</span>
        <h1>{title}</h1>
        <p>{description}</p>
      </div>
      {action}
    </div>
  );
}
function Modal({
  title,
  children,
  onClose,
  closeLabel = "Fechar",
}: {
  title: string;
  children: React.ReactNode;
  onClose: () => void;
  closeLabel?: string;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const el = ref.current;
    const previous = document.activeElement as HTMLElement;
    el?.showModal();
    return () => {
      el?.close();
      previous?.focus();
    };
  }, []);
  return (
    <dialog
      className="modal"
      ref={ref}
      aria-label={title}
      onCancel={onClose}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="modal-header">
        <span>{title}</span>
        <button
          className="icon-button"
          aria-label={closeLabel}
          onClick={onClose}
        >
          <X size={19} />
        </button>
      </div>
      <div className="modal-body">{children}</div>
    </dialog>
  );
}
