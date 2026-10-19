import { beforeEach, afterEach, describe, it, expect, vi } from "vitest";
const { client, verify, admin, create } = vi.hoisted(() => ({
  client: {
    auth: { getUser: vi.fn(), signOut: vi.fn() },
    rpc: vi.fn(),
    from: vi.fn(),
  },
  verify: { auth: { signInWithPassword: vi.fn(), signOut: vi.fn() } },
  admin: { rpc: vi.fn() },
  create: vi.fn(),
}));
vi.mock("../src/lib/supabase/server", () => ({
  createClient: async () => client,
}));
vi.mock("../src/lib/supabase/config", () => ({ isConfigured: () => true }));
vi.mock("@supabase/supabase-js", () => ({ createClient: create }));
import { DELETE } from "../src/app/api/account/route";
import { POST as confirm } from "../src/app/api/recurrences/confirm/route";
import { POST as pay } from "../src/app/api/loans/pay/route";
import { readJson } from "../src/lib/api";
import { today } from "../src/lib/finance/dates";
const uid = "11111111-1111-4111-8111-111111111111",
  other = "22222222-2222-4222-8222-222222222222";
const req = (path: string, body: unknown, origin = "https://meu-norte.test") =>
  new Request(`https://meu-norte.test${path}`, {
    method: "POST",
    headers: { origin },
    body: JSON.stringify(body),
  });
beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv("APP_ORIGIN", "https://meu-norte.test");
  vi.stubEnv("SUPABASE_SECRET_KEY", "server-only-test");
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://example.supabase.co");
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "public-test");
  client.auth.getUser.mockResolvedValue({
    data: { user: { id: uid, email: "owner@example.com" } },
    error: null,
  });
  client.auth.signOut.mockResolvedValue({ error: null });
  client.rpc.mockResolvedValue({ data: true, error: null });
  verify.auth.signInWithPassword.mockResolvedValue({
    data: { user: { id: uid } },
    error: null,
  });
  verify.auth.signOut.mockResolvedValue({ error: null });
  admin.rpc.mockResolvedValue({ error: null });
  create.mockReset();
  create.mockReturnValueOnce(verify).mockReturnValueOnce(admin);
});
afterEach(() => vi.unstubAllEnvs());
describe("fronteiras de segurança da fase 2", () => {
  it("exclusão usa a identidade da sessão e ignora o user_id enviado", async () => {
    const r = await DELETE(
      req("/api/account", {
        password: "senha-atual",
        confirmation: "APAGAR",
        user_id: other,
      }),
    );
    expect(r.status).toBe(200);
    expect(admin.rpc).toHaveBeenCalledWith("delete_account_completely", {
      p_user: uid,
    });
    expect(verify.auth.signInWithPassword).toHaveBeenCalledWith({
      email: "owner@example.com",
      password: "senha-atual",
    });
  });
  it("senha incorreta impede a exclusão privilegiada", async () => {
    verify.auth.signInWithPassword.mockResolvedValueOnce({
      data: { user: null },
      error: { message: "invalid" },
    });
    const r = await DELETE(
      req("/api/account", { password: "errada", confirmation: "APAGAR" }),
    );
    expect(r.status).toBe(401);
    expect(admin.rpc).not.toHaveBeenCalled();
  });
  it("origem externa e ausência de login nunca chegam à operação", async () => {
    expect(
      (
        await DELETE(
          req(
            "/api/account",
            { password: "x", confirmation: "APAGAR" },
            "https://evil.test",
          ),
        )
      ).status,
    ).toBe(403);
    client.auth.getUser.mockResolvedValueOnce({
      data: { user: null },
      error: null,
    });
    expect(
      (
        await DELETE(
          req("/api/account", { password: "x", confirmation: "APAGAR" }),
        )
      ).status,
    ).toBe(401);
    expect(create).not.toHaveBeenCalled();
  });
  it("não exige nem expõe chave privada para o restante do app", async () => {
    vi.stubEnv("SUPABASE_SECRET_KEY", "");
    expect(
      (
        await DELETE(
          req("/api/account", { password: "x", confirmation: "APAGAR" }),
        )
      ).status,
    ).toBe(503);
    expect(create).not.toHaveBeenCalled();
  });
  it("limite de escrita recusa antes de alterar parcelas", async () => {
    client.rpc.mockResolvedValueOnce({ data: false, error: null });
    const r = await pay(
      req("/api/loans/pay", {
        id: uid,
        number: 1,
        account_id: other,
        date: "2026-01-01",
        amount_cents: 100,
      }),
    );
    expect(r.status).toBe(429);
    expect(client.rpc).not.toHaveBeenCalledWith(
      "pay_loan_installment",
      expect.anything(),
    );
  });
  it("confirmação recusa data de pagamento futura", async () => {
    const chain = {
      eq: vi.fn(),
      maybeSingle: async () => ({
        data: {
          id: uid,
          status: "planned",
          recurrence_id: other,
          date: "2099-01-01",
        },
        error: null,
      }),
    };
    chain.eq.mockReturnValue(chain);
    client.from.mockReturnValue({ select: () => chain });
    const r = await confirm(
      req("/api/recurrences/confirm", {
        id: uid,
        action: "confirm",
        date: "2099-01-01",
      }),
    );
    expect(r.status).toBe(422);
  });
  it("confirma pagamento antecipado com data real e mantém a atualização idempotente", async () => {
    const read = {
      eq: vi.fn(),
      maybeSingle: vi
        .fn()
        .mockResolvedValue({
          data: {
            id: uid,
            status: "planned",
            recurrence_id: other,
            date: "2099-01-01",
          },
          error: null,
        }),
    };
    read.eq.mockReturnValue(read);
    const write = { eq: vi.fn(), error: null };
    write.eq.mockReturnValue(write);
    const update = vi.fn().mockReturnValue(write);
    client.from.mockReturnValue({ select: () => read, update });
    const body = { id: uid, action: "confirm", date: today() };
    expect((await confirm(req("/api/recurrences/confirm", body))).status).toBe(
      200,
    );
    expect(update).toHaveBeenCalledWith({ status: "posted", date: today() });
    expect(read.eq).toHaveBeenCalledWith("user_id", uid);
    expect(write.eq).toHaveBeenCalledWith("user_id", uid);
    expect(write.eq).toHaveBeenCalledWith("status", "planned");
    read.maybeSingle.mockResolvedValueOnce({
      data: { id: uid, status: "posted", recurrence_id: other, date: today() },
      error: null,
    });
    expect((await confirm(req("/api/recurrences/confirm", body))).status).toBe(
      200,
    );
    expect(update).toHaveBeenCalledTimes(1);
  });
  it("confirmar sem data usa hoje em vez de antecipar o lançamento no histórico", async () => {
    const read = {
      eq: vi.fn(),
      maybeSingle: async () => ({
        data: {
          id: uid,
          status: "planned",
          recurrence_id: other,
          date: "2026-01-01",
        },
        error: null,
      }),
    };
    read.eq.mockReturnValue(read);
    const write = { eq: vi.fn(), error: null };
    write.eq.mockReturnValue(write);
    const update = vi.fn().mockReturnValue(write);
    client.from.mockReturnValue({ select: () => read, update });
    expect(
      (
        await confirm(
          req("/api/recurrences/confirm", { id: uid, action: "confirm" }),
        )
      ).status,
    ).toBe(200);
    expect(update).toHaveBeenCalledWith({ status: "posted", date: today() });
  });
  it("limite de payload é em bytes e vale para corpos sem content-length", async () => {
    const r = new Request("https://meu-norte.test", {
      method: "POST",
      body: JSON.stringify({ text: "á".repeat(7000) }),
    });
    await expect(readJson(r)).rejects.toMatchObject({ status: 413 });
  });
});

describe("IPCA observado para apoiar a hipótese manual", () => {
  it("compõe 12 variações mensais em vez de somá-las", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify(
          Array.from({ length: 12 }, (_, i) => ({
            data: `01/${String(i + 1).padStart(2, "0")}/2025`,
            valor: "1.00",
          })),
        ),
        { status: 200 },
      ),
    );
    vi.stubGlobal("fetch", fetchMock);
    try {
      const { GET } = await import("../src/app/api/indicators/ipca/route");
      const r = await GET();
      const body = await r.json();
      expect(r.status).toBe(200);
      expect(body.annual_rate).toBeCloseTo(Math.pow(1.01, 12) - 1, 12);
      expect(body.annual_rate).not.toBe(0.12);
      expect(body.source).toContain("Banco Central");
    } finally {
      vi.unstubAllGlobals();
    }
  });
  it("falha externa permite preencher manualmente sem inventar taxa", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("timeout")));
    try {
      const { GET } = await import("../src/app/api/indicators/ipca/route");
      const r = await GET();
      expect(r.status).toBe(503);
      expect(await r.json()).not.toHaveProperty("annual_rate");
    } finally {
      vi.unstubAllGlobals();
    }
  });
});
