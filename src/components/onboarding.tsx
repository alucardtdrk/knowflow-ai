"use client";
/* eslint-disable @next/next/no-img-element */
import { useState } from "react";
import { useRouter } from "next/navigation";
import { organizationAction, acceptInviteAction } from "@/app/actions";
import type { PendingInvitation } from "@/lib/workspace";

export function PendingInvitations({
  invitations,
}: {
  invitations: PendingInvitation[];
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  if (!invitations.length) return null;
  return (
    <section
      className="panel received-invitations"
      aria-label="Convites recebidos"
    >
      <h2>Convites recebidos</h2>
      <p>
        Entre em uma equipe existente. Você não precisa criar outra organização.
      </p>
      {invitations.map((invite) => (
        <div className="member-row" key={invite.id}>
          <div>
            <strong>
              {invite.organizationName} · {invite.teamName}
            </strong>
            <span>{invite.role === "manager" ? "Gestor" : "Membro"}</span>
          </div>
          <button
            className="button primary"
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              const result = await acceptInviteAction(invite.id);
              if (result.ok) {
                router.push(`/app/${result.data.teamId}`);
                router.refresh();
              } else {
                setError(result.error);
                setBusy(false);
              }
            }}
          >
            Entrar na equipe
          </button>
        </div>
      ))}
      {error && (
        <p className="error-text" role="alert">
          {error}
        </p>
      )}
    </section>
  );
}

export function Onboarding({
  name,
  invitations = [],
}: {
  name: string;
  invitations?: PendingInvitation[];
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  return (
    <main className="auth-page">
      <div className="auth-card">
        <img
          className="auth-logo"
          src="/brand/knowflow-wordmark.svg"
          alt="KnowFlow AI"
        />
        <span className="eyebrow">VAMOS COMEÇAR</span>
        <h1>Um espaço para o que sua equipe sabe.</h1>
        <p>
          Olá, {name}. Aceite um convite recebido ou crie uma organização se
          você estiver começando uma nova equipe.
        </p>
        <PendingInvitations invitations={invitations} />
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            setBusy(true);
            const f = new FormData(e.currentTarget);
            const r = await organizationAction(String(f.get("name")));
            if (r.ok) router.push(`/app/${r.data.teamId}`);
            else setError(r.error);
            setBusy(false);
          }}
        >
          <label>
            Nome da organização
            <input
              name="name"
              required
              minLength={2}
              maxLength={80}
              placeholder="Ex.: Acme Studio"
            />
          </label>
          <button className="button primary full" disabled={busy}>
            Criar organização
          </button>
        </form>
        {error && (
          <p role="alert" className="error-text">
            {error}
          </p>
        )}
        <a href="/demo" className="text-link">
          Explorar demonstração
        </a>
      </div>
    </main>
  );
}
export function Invite({
  token,
  authenticated,
}: {
  token: string;
  authenticated: boolean;
}) {
  const loginUrl = `/login?invite=${encodeURIComponent(token)}`;
  const router = useRouter();
  const [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  return (
    <main className="auth-page">
      <div className="auth-card">
        <span className="eyebrow">CONVITE PARA EQUIPE</span>
        <h1>Conhecimento fica melhor quando é compartilhado.</h1>
        <p>Entre com o email que recebeu o convite antes de aceitar.</p>
        <a className="text-link" href={loginUrl}>
          Entrar ou criar minha conta
        </a>
        <button
          className="button primary full"
          disabled={busy}
          onClick={async () => {
            if (!authenticated) {
              router.push(loginUrl);
              return;
            }
            setBusy(true);
            const r = await acceptInviteAction(token);
            if (r.ok) router.push(`/app/${r.data.teamId}`);
            else setError(r.error);
            setBusy(false);
          }}
        >
          {authenticated ? "Aceitar convite" : "Entrar para aceitar convite"}
        </button>
        {error && (
          <p role="alert" className="error-text">
            {error}
          </p>
        )}
      </div>
    </main>
  );
}
