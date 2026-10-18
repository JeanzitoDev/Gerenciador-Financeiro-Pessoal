"use client";
import { Compass } from "lucide-react";
export default function ErrorPage({ reset }: { reset: () => void }) {
  return (
    <main className="loading-page">
      <Compass size={42} />
      <h1>Não foi possível abrir este espaço.</h1>
      <p>Tente novamente em alguns instantes.</p>
      <button className="button primary" onClick={reset}>
        Tentar novamente
      </button>
    </main>
  );
}
