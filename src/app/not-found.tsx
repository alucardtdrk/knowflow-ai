import Link from "next/link";
export default function NotFound() {
  return (
    <main className="auth-page">
      <div className="auth-card">
        <span className="eyebrow">KNOWFLOW AI</span>
        <h1>Este espaço não está disponível.</h1>
        <p>
          Confira se você está na conta correta e se participa desta equipe.
        </p>
        <Link className="button primary" href="/app">
          Voltar aos meus espaços
        </Link>
      </div>
    </main>
  );
}
