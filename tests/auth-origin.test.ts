import { afterEach, beforeEach, describe, it, expect, vi } from "vitest";
const { client } = vi.hoisted(() => ({
  client: {
    auth: {
      signUp: vi.fn(),
      exchangeCodeForSession: vi.fn(),
      resetPasswordForEmail: vi.fn(),
    },
  },
}));
vi.mock("../src/lib/supabase/server", () => ({
  createClient: async () => client,
}));
vi.mock("../src/lib/supabase/config", () => ({ isConfigured: () => true }));
import { POST } from "../src/app/api/auth/route";
import { GET } from "../src/app/auth/callback/route";
beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv("NODE_ENV", "development");
  vi.stubEnv("APP_ORIGIN", "");
  client.auth.signUp.mockResolvedValue({ error: null });
  client.auth.exchangeCodeForSession.mockResolvedValue({ error: null });
  client.auth.resetPasswordForEmail.mockResolvedValue({ error: null });
});
afterEach(() => vi.unstubAllEnvs());
describe("fluxo Auth com localhost e bind interno diferente", () => {
  it("cadastro passa pela proteção e usa URL visível no e-mail", async () => {
    const response = await POST(
      new Request("http://0.0.0.0:3000/api/auth", {
        method: "POST",
        headers: { origin: "http://localhost:3000", host: "localhost:3000" },
        body: JSON.stringify({
          action: "signup",
          email: "teste@example.com",
          password: "senha-de-teste-123",
        }),
      }),
    );
    expect(response.status).toBe(200);
    expect(client.auth.signUp).toHaveBeenCalledWith(
      expect.objectContaining({
        options: { emailRedirectTo: "http://localhost:3000/auth/callback" },
      }),
    );
  });
  it("recuperação usa o mesmo hostname do navegador", async () => {
    const response = await POST(
      new Request("http://0.0.0.0:3000/api/auth", {
        method: "POST",
        headers: { origin: "http://localhost:3000", host: "localhost:3000" },
        body: JSON.stringify({ action: "reset", email: "teste@example.com" }),
      }),
    );
    expect(response.status).toBe(200);
    expect(client.auth.resetPasswordForEmail).toHaveBeenCalledWith(
      "teste@example.com",
      { redirectTo: "http://localhost:3000/auth/callback?next=/nova-senha" },
    );
  });
  it("callback volta para localhost em vez de 0.0.0.0 e rejeita open redirect", async () => {
    const response = await GET(
      new Request(
        "http://0.0.0.0:3000/auth/callback?code=test&next=https://evil.test",
        { headers: { host: "localhost:3000" } },
      ),
    );
    expect(response.headers.get("location")).toBe("http://localhost:3000/app");
  });
  it("callback de recuperação mantém o destino permitido", async () => {
    const response = await GET(
      new Request(
        "http://0.0.0.0:3000/auth/callback?code=test&next=/nova-senha",
        { headers: { host: "localhost:3000" } },
      ),
    );
    expect(response.headers.get("location")).toBe(
      "http://localhost:3000/nova-senha",
    );
  });
  it("cadastro de origem externa continua bloqueado antes do Supabase", async () => {
    const response = await POST(
      new Request("http://0.0.0.0:3000/api/auth", {
        method: "POST",
        headers: { origin: "https://evil.test", host: "localhost:3000" },
        body: JSON.stringify({
          action: "signup",
          email: "teste@example.com",
          password: "senha-de-teste-123",
        }),
      }),
    );
    expect(response.status).toBe(403);
    expect(client.auth.signUp).not.toHaveBeenCalled();
  });
});
