import { beforeEach, afterEach, describe, it, expect, vi } from "vitest";
const { client } = vi.hoisted(() => ({
  client: { auth: { getUser: vi.fn() }, rpc: vi.fn(), from: vi.fn() },
}));
vi.mock("../src/lib/supabase/server", () => ({
  createClient: async () => client,
}));
vi.mock("../src/lib/supabase/config", () => ({ isConfigured: () => true }));
import { GET } from "../src/app/api/indicators/credit/route";
import { PUT } from "../src/app/api/onboarding/route";
const uid = "11111111-1111-4111-8111-111111111111";
beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv("APP_ORIGIN", "https://meu-norte.test");
  client.auth.getUser.mockResolvedValue({
    data: { user: { id: uid } },
    error: null,
  });
  client.rpc.mockResolvedValue({ data: true, error: null });
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});
describe("referências gratuitas pelo servidor", () => {
  it("converte corretamente juros anuais de imóveis e mantém unidade/fonte/data", async () => {
    const fetch = vi
      .fn()
      .mockResolvedValue(Response.json([{ valor: "12", data: "01/08/2026" }]));
    vi.stubGlobal("fetch", fetch);
    const response = await GET(
      new Request(
        "https://meu-norte.test/api/indicators/credit?kind=home&salary=99999",
      ),
    );
    const body = await response.json();
    expect(response.status).toBe(200);
    expect(body.monthly_rate).toBeCloseTo(0.009488792934583, 12);
    expect(body.original_unit).toBe("year");
    expect(fetch).toHaveBeenCalledWith(
      "https://api.bcb.gov.br/dados/serie/bcdata.sgs.20772/dados/ultimos/1?formato=json",
      expect.objectContaining({
        credentials: "omit",
        redirect: "error",
        next: { revalidate: 21600 },
      }),
    );
    expect(JSON.stringify(fetch.mock.calls)).not.toContain("salary");
    expect(response.headers.get("cache-control")).toBe("private, no-store");
  });
  it("veículos já vêm ao mês; URLs arbitrárias e usuários sem sessão não chegam ao provedor", async () => {
    const fetch = vi
      .fn()
      .mockResolvedValue(Response.json([{ valor: "2,1", data: "01/08/2026" }]));
    vi.stubGlobal("fetch", fetch);
    expect(
      (
        await (
          await GET(
            new Request(
              "https://meu-norte.test/api/indicators/credit?kind=vehicle",
            ),
          )
        ).json()
      ).monthly_rate,
    ).toBeCloseTo(0.021);
    fetch.mockClear();
    expect(
      (
        await GET(
          new Request(
            "https://meu-norte.test/api/indicators/credit?kind=https://evil.test",
          ),
        )
      ).status,
    ).toBe(422);
    client.auth.getUser.mockResolvedValue({
      data: { user: null },
      error: null,
    });
    expect(
      (
        await GET(
          new Request("https://meu-norte.test/api/indicators/credit?kind=home"),
        )
      ).status,
    ).toBe(401);
    expect(fetch).not.toHaveBeenCalled();
  });
  it("respostas inválidas ou indisponibilidade devolvem opção de taxa manual", async () => {
    const fetch = vi.fn();
    vi.stubGlobal("fetch", fetch);
    for (const rows of [
      [],
      [{ valor: "x", data: "01/08/2026" }],
      [{ valor: "2", data: "31/02/2026" }],
      [{ valor: "200", data: "01/08/2026" }],
    ]) {
      fetch.mockResolvedValueOnce(Response.json(rows));
      const response = await GET(
        new Request(
          "https://meu-norte.test/api/indicators/credit?kind=vehicle",
        ),
      );
      expect(response.status).toBe(503);
      expect((await response.json()).error).toMatch(/informar a taxa/);
    }
    fetch.mockRejectedValueOnce(new Error("timeout"));
    expect(
      (
        await GET(
          new Request("https://meu-norte.test/api/indicators/credit?kind=home"),
        )
      ).status,
    ).toBe(503);
  });
});
describe("tutorial vinculado ao perfil autenticado", () => {
  const request = (step: unknown, origin = "https://meu-norte.test") =>
    new Request("https://meu-norte.test/api/onboarding", {
      method: "PUT",
      headers: { origin },
      body: JSON.stringify({ step, user_id: "other" }),
    });
  it("grava só etapa e dono da sessão", async () => {
    const query = {
      update: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      maybeSingle: vi
        .fn()
        .mockResolvedValue({ data: { user_id: uid }, error: null }),
    };
    client.from.mockReturnValue(query);
    expect((await PUT(request(2))).status).toBe(200);
    expect(query.update).toHaveBeenCalledWith({
      onboarding_step: 2,
      onboarding_dismissed: false,
      onboarding_completed_at: null,
    });
    expect(query.eq).toHaveBeenCalledWith("user_id", uid);
  });
  it("valida etapa e origem antes de gravar", async () => {
    expect((await PUT(request(6))).status).toBe(422);
    expect((await PUT(request(0, "https://evil.test"))).status).toBe(403);
    expect(client.from).not.toHaveBeenCalled();
  });
  it("registra a conclusão com horário do servidor, sem aceitar uma data do cliente", async () => {
    const query = {
      update: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      maybeSingle: vi
        .fn()
        .mockResolvedValue({ data: { user_id: uid }, error: null }),
    };
    client.from.mockReturnValue(query);
    const response = await PUT(
      new Request("https://meu-norte.test/api/onboarding", {
        method: "PUT",
        headers: { origin: "https://meu-norte.test" },
        body: JSON.stringify({
          step: 4,
          completed_at: "1900-01-01",
          user_id: "other",
        }),
      }),
    );
    const body = await response.json();
    expect(response.status).toBe(200);
    expect(body.completed_at).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    expect(query.update).toHaveBeenCalledWith({
      onboarding_step: 4,
      onboarding_dismissed: false,
      onboarding_completed_at: body.completed_at,
    });
    expect(query.eq).toHaveBeenCalledWith("user_id", uid);
  });
});

describe("edição de metas por cliente anterior", () => {
  it("preserva conclusão e condições quando a versão antiga não envia esses campos", async () => {
    const condition = {
      goal_id: "22222222-2222-4222-8222-222222222222",
      minimum_cents: null,
    };
    const query = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      update: vi.fn().mockReturnThis(),
      maybeSingle: vi
        .fn()
        .mockResolvedValueOnce({
          data: { completed: true, dependencies: [condition] },
          error: null,
        })
        .mockResolvedValueOnce({ data: { id: uid }, error: null }),
    };
    client.from.mockReturnValue(query);
    const { PUT: updateGoal } =
      await import("../src/app/api/records/[entity]/route");
    const response = await updateGoal(
      new Request("https://meu-norte.test/api/records/goals", {
        method: "PUT",
        headers: { origin: "https://meu-norte.test" },
        body: JSON.stringify({
          id: uid,
          name: "Nome novo",
          target_cents: 100000,
          target_date: "2027-01-01",
          priority: 1,
          monthly_budget_cents: null,
          user_id: "other",
        }),
      }),
      { params: Promise.resolve({ entity: "goals" }) },
    );
    expect(response.status).toBe(200);
    expect(query.update).toHaveBeenCalledWith(
      expect.objectContaining({
        name: "Nome novo",
        completed: true,
        dependencies: [condition],
      }),
    );
    expect(query.update.mock.calls[0][0]).not.toHaveProperty("user_id");
    expect(query.eq).toHaveBeenCalledWith("user_id", uid);
  });
});
