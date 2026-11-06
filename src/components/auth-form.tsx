"use client";
/* eslint-disable @next/next/no-img-element */
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { createAuthClient } from "better-auth/react";
import { ArrowUpRight, ArrowRight, BookOpen, ShieldCheck } from "lucide-react";
const authClient = createAuthClient();
export function AuthForm({ configured }: { configured: boolean }) {
  const router = useRouter();
  const [signup, setSignup] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  return (
    <main className="login-layout">
      <aside className="login-story">
        <Link href="/demo" className="brand">
          <img src="/brand/knowflow-wordmark.svg" alt="KnowFlow AI" />
        </Link>
        <div>
          <span className="eyebrow">CONHECIMENTO QUE RESOLVE</span>
          <h1>
            O próximo passo
            <br />
            já está nos
            <br />
            <em>seus documentos.</em>
          </h1>
          <p>
            Conecte o que sua equipe sabe
            <br />
            com o que ela precisa resolver.
          </p>
          <div className="story-note">
            <BookOpen size={22} />
            <span>
              Menos tempo procurando.
              <br />
              Mais clareza para seguir em frente.
            </span>
          </div>
        </div>
        <span className="small muted">
          Feito para pessoas. Baseado em conhecimento.
        </span>
      </aside>
      <section className="login-form">
        <Link className="text-link back-demo" href="/demo">
          Explorar demonstração <ArrowUpRight size={15} />
        </Link>
        <div className="auth-card">
          <span className="eyebrow">SEU ESPAÇO DE CONHECIMENTO</span>
          <h2>
            {signup ? "Comece com sua equipe." : "Bom ter você de volta."}
          </h2>
          <p className="muted">
            {signup
              ? "Crie sua conta e organize o conhecimento da equipe."
              : "Entre para encontrar respostas e continuar de onde parou."}
          </p>
          {!configured && (
            <div className="notice">
              A aplicação precisa de banco e autenticação configurados. A
              demonstração está disponível sem cadastro.
            </div>
          )}
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              setError("");
              setBusy(true);
              const f = new FormData(e.currentTarget);
              try {
                const result = signup
                  ? await authClient.signUp.email({
                      name: String(f.get("name")),
                      email: String(f.get("email")),
                      password: String(f.get("password")),
                    })
                  : await authClient.signIn.email({
                      email: String(f.get("email")),
                      password: String(f.get("password")),
                    });
                if (result.error)
                  setError(
                    "Não foi possível entrar. Confira seus dados ou tente outro email ao criar uma conta.",
                  );
                else router.push("/app");
              } catch {
                setError("Não foi possível conectar. Tente novamente.");
              } finally {
                setBusy(false);
              }
            }}
          >
            {signup && (
              <label>
                Seu nome
                <input
                  name="name"
                  autoComplete="name"
                  required
                  minLength={2}
                  maxLength={80}
                  placeholder="Como podemos chamar você?"
                />
              </label>
            )}
            <label>
              Email
              <input
                name="email"
                type="email"
                autoComplete="email"
                required
                placeholder="voce@equipe.com"
              />
            </label>
            <label>
              Senha
              <input
                name="password"
                type="password"
                required
                minLength={10}
                autoComplete={signup ? "new-password" : "current-password"}
                placeholder="Pelo menos 10 caracteres"
              />
            </label>
            {error && (
              <p role="alert" className="error-text">
                {error}
              </p>
            )}
            <button
              className="button primary full"
              disabled={!configured || busy}
            >
              {busy
                ? "Aguarde…"
                : signup
                  ? "Criar conta"
                  : "Entrar no meu espaço"}
              <ArrowRight size={17} />
            </button>
          </form>
          <p className="auth-toggle">
            {signup ? "Já tem uma conta?" : "Primeira vez por aqui?"}{" "}
            <button
              onClick={() => {
                setSignup(!signup);
                setError("");
              }}
              className="text-link"
            >
              {signup ? "Entrar" : "Criar conta"}
            </button>
          </p>
          <div className="privacy-note">
            <ShieldCheck size={16} /> Seus documentos ficam nos espaços
            autorizados da sua equipe.
          </div>
        </div>
      </section>
    </main>
  );
}
