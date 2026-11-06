"use client";
export default function ErrorPage({ reset }: { reset: () => void }) {
  return (
    <main className="auth-page">
      <div className="auth-card">
        <h1>Não foi possível abrir este espaço.</h1>
        <p>Confira a conexão e a configuração do servidor.</p>
        <button className="button primary" onClick={reset}>
          Tentar novamente
        </button>
      </div>
    </main>
  );
}
