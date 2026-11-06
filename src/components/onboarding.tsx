"use client";
/* eslint-disable @next/next/no-img-element */
import { useState } from "react";
import { useRouter } from "next/navigation";
import { organizationAction, acceptInviteAction } from "@/app/actions";
export function Onboarding({ name }: { name: string }) {
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
          Olá, {name}. Crie sua organização ou abra o link de convite que
          recebeu.
        </p>
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
export function Invite({ token }: { token: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  return (
    <main className="auth-page">
      <div className="auth-card">
        <span className="eyebrow">CONVITE PARA EQUIPE</span>
        <h1>Conhecimento fica melhor quando é compartilhado.</h1>
        <p>Entre com o email que recebeu o convite antes de aceitar.</p>
        <a className="text-link" href="/login">
          Entrar ou criar minha conta
        </a>
        <button
          className="button primary full"
          disabled={busy}
          onClick={async () => {
            setBusy(true);
            const r = await acceptInviteAction(token);
            if (r.ok) router.push(`/app/${r.data.teamId}`);
            else setError(r.error);
            setBusy(false);
          }}
        >
          Aceitar convite
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
