"use client";
import { useState } from "react";
import Link from "next/link";
import { Compass, ArrowRight, ShieldCheck } from "lucide-react";
export default function AuthForm({
  configured,
  updatePassword = false,
}: {
  configured: boolean;
  updatePassword?: boolean;
}) {
  const [mode, setMode] = useState<"login" | "signup" | "reset" | "update">(
    updatePassword ? "update" : "login",
  );
  const [email, setEmail] = useState(""),
    [password, setPassword] = useState(""),
    [busy, setBusy] = useState(false),
    [message, setMessage] = useState(""),
    [error, setError] = useState("");
  const change = (mode: "login" | "signup" | "reset" | "update") => {
    setMode(mode);
    setError("");
    setMessage("");
    setPassword("");
  };
  const titles = {
    login: "Bom te ver por aqui.",
    signup: "Seu próximo passo começa aqui.",
    reset: "Recupere seu acesso.",
    update: "Uma nova senha.",
  };
  const subtitles = {
    login: "Entre para cuidar do seu dinheiro, no seu ritmo.",
    signup: "Crie sua conta e dê uma direção aos seus planos.",
    reset: "Enviaremos um link de recuperação para seu e-mail.",
    update: "Use pelo menos 12 caracteres para sua nova senha.",
  };
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const response = await fetch("/api/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: mode,
          ...(mode !== "update" ? { email } : {}),
          ...(mode !== "reset" ? { password } : {}),
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      if (mode === "login" || mode === "update") {
        window.location.assign("/app");
        return;
      }
      setMessage(data.message);
      setPassword("");
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Não foi possível concluir.",
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="auth-page">
      <aside className="auth-aside">
        <Link href="/" className="brand">
          <span className="brand-symbol">
            <Compass size={26} />
          </span>
          meu norte<span className="brand-dot">.</span>
        </Link>
        <div>
          <p className="eyebrow" style={{ color: "#d5caef" }}>
            UM PASSO DE CADA VEZ
          </p>
          <h2>
            Mais clareza.
            <br />
            Mais possibilidades.
          </h2>
          <p>
            Um espaço para organizar o presente e dar forma ao que você quer
            conquistar.
          </p>
        </div>
        <small>Seu dinheiro, seus caminhos.</small>
        <div className="hero-orbit one" />
        <div className="hero-orbit two" />
      </aside>
      <main className="auth-main">
        <div className="auth-card">
          <Link href="/" className="brand">
            <span className="brand-symbol">
              <Compass size={25} />
            </span>
            meu norte<span className="brand-dot">.</span>
          </Link>
          <h1>{titles[mode]}</h1>
          <p>{subtitles[mode]}</p>
          {!configured && (
            <div className="info-box">
              <ShieldCheck size={18} />
              <span>
                O acesso real precisa de um projeto Supabase configurado. Você
                pode <Link href="/demo">explorar a demonstração</Link> enquanto
                isso.
              </span>
            </div>
          )}
          <form onSubmit={submit} className="auth-form">
            {mode !== "update" && (
              <label className="form-field">
                <span>E-mail</span>
                <input
                  type="email"
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  maxLength={254}
                  required
                  placeholder="voce@email.com"
                />
              </label>
            )}
            {mode !== "reset" && (
              <label className="form-field">
                <span>{mode === "update" ? "Nova senha" : "Senha"}</span>
                <input
                  type="password"
                  autoComplete={
                    mode === "login" ? "current-password" : "new-password"
                  }
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  minLength={mode === "login" ? 1 : 12}
                  maxLength={128}
                  required
                  placeholder={
                    mode === "login" ? "Sua senha" : "Pelo menos 12 caracteres"
                  }
                />
              </label>
            )}
            {error && (
              <p className="form-error" role="alert">
                {error}
              </p>
            )}
            {message && (
              <p className="auth-alert" role="status">
                {message}
              </p>
            )}
            <button
              type="submit"
              className="button primary wide"
              disabled={busy || !configured}
            >
              {busy
                ? "Aguarde…"
                : mode === "login"
                  ? "Entrar no meu espaço"
                  : mode === "signup"
                    ? "Criar minha conta"
                    : mode === "reset"
                      ? "Enviar link"
                      : "Salvar nova senha"}
              <ArrowRight size={17} />
            </button>
          </form>
          {mode === "login" && (
            <>
              <div className="auth-links">
                <button onClick={() => change("reset")}>
                  Esqueci minha senha
                </button>
                <span className="muted" style={{ fontSize: 10 }}>
                  Acesso seguro
                </span>
              </div>
              <p className="auth-switch">
                Ainda não tem uma conta?
                <button onClick={() => change("signup")}>Criar conta</button>
              </p>
            </>
          )}
          {mode !== "login" && (
            <p className="auth-switch">
              <button onClick={() => change("login")}>
                Voltar para entrar
              </button>
            </p>
          )}
          <p className="auth-link-bottom">
            <Link href="/demo">Conhecer com dados fictícios →</Link>
          </p>
        </div>
      </main>
    </div>
  );
}
