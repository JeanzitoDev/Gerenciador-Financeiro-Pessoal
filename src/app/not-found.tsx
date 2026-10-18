import Link from "next/link";
import { Compass } from "lucide-react";
export default function NotFound() {
  return (
    <main className="loading-page">
      <Compass size={42} />
      <h1>Vamos encontrar seu norte.</h1>
      <p>Esta página não foi encontrada.</p>
      <Link className="button primary" href="/">
        Voltar ao início
      </Link>
    </main>
  );
}
