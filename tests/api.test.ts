import { beforeEach, describe, it, expect, vi } from "vitest";
const { client } = vi.hoisted(() => ({
  client: { auth: { getUser: vi.fn() }, from: vi.fn(), rpc: vi.fn() },
}));
vi.mock("../src/lib/supabase/server", () => ({
  createClient: async () => client,
}));
vi.mock("../src/lib/supabase/config", () => ({ isConfigured: () => true }));
import { POST, PUT, DELETE } from "../src/app/api/records/[entity]/route";
import { GET } from "../src/app/api/data/route";
import { POST as generate } from "../src/app/api/recurrences/generate/route";
const uid = "11111111-1111-4111-8111-111111111111";
function request(
  method: string,
  body: unknown,
  origin = "https://meu-norte.test",
) {
  return new Request("https://meu-norte.test/api/records/accounts", {
    method,
    headers: { origin, "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}
const context = (entity: string) => ({ params: Promise.resolve({ entity }) });
beforeEach(() => {
  vi.clearAllMocks();
  client.auth.getUser.mockResolvedValue({
    data: { user: { id: uid } },
    error: null,
  });
});
describe("fronteira HTTP e isolamento no servidor", () => {
  it("rejeita Origin externo antes de consultar dados", async () => {
    const r = await POST(
      request("POST", {}, "https://evil.test"),
      context("accounts"),
    );
    expect(r.status).toBe(403);
    expect(client.from).not.toHaveBeenCalled();
  });
  it("recusa sessão ausente e entidade não exposta", async () => {
    client.auth.getUser.mockResolvedValue({
      data: { user: null },
      error: null,
    });
    expect((await POST(request("POST", {}), context("accounts"))).status).toBe(
      401,
    );
    expect(
      (await POST(request("POST", {}), context("import_batches"))).status,
    ).toBe(404);
  });
  it("o dono vem da identidade validada e campos extras são descartados", async () => {
    const insert = vi.fn(() => ({
      select: () => ({
        maybeSingle: async () => ({ data: { id: uid }, error: null }),
      }),
    }));
    client.from.mockReturnValue({ insert });
    const r = await POST(
      request("POST", {
        name: "Conta",
        kind: "checking",
        opening_cents: 100,
        opening_date: "2026-01-01",
        user_id: "vitima",
        evil: "ignorado",
      }),
      context("accounts"),
    );
    expect(r.status).toBe(201);
    expect(insert).toHaveBeenCalledWith({
      name: "Conta",
      kind: "checking",
      opening_cents: 100,
      opening_date: "2026-01-01",
      user_id: uid,
    });
  });
  it("erros de referência não vazam detalhes do banco", async () => {
    const chain = { eq: vi.fn(), select: vi.fn() };
    chain.eq.mockReturnValue(chain);
    chain.select.mockResolvedValue({
      data: null,
      error: { code: "23503", message: "foreign key sensitive details" },
    });
    client.from.mockReturnValue({ delete: () => chain });
    const r = await DELETE(request("DELETE", { id: uid }), context("accounts"));
    expect(r.status).toBe(409);
    expect(await r.text()).not.toContain("sensitive");
    expect(chain.eq).toHaveBeenCalledWith("user_id", uid);
  });
  it("paginação lê além de 500 sem truncar histórico", async () => {
    client.from.mockImplementation((table: string) => ({
      select: () => ({
        eq: (field: string, owner: string) => {
          expect(field).toBe("user_id");
          expect(owner).toBe(uid);
          return table === "profiles"
            ? { maybeSingle: async () => ({ data: null, error: null }) }
            : {
                order: () => ({
                  range: async (start: number) => ({
                    data:
                      table === "accounts"
                        ? start === 0
                          ? Array.from({ length: 500 }, (_, i) => ({
                              id: String(i),
                            }))
                          : [{ id: "501" }]
                        : [],
                    error: null,
                  }),
                }),
              };
        },
      }),
    }));
    const r = await GET();
    expect(r.status).toBe(200);
    const body = await r.json();
    expect(body.accounts).toHaveLength(501);
    expect(r.headers.get("cache-control")).toContain("no-store");
  });
  it("ID inválido e payload inválido não chegam à escrita", async () => {
    expect(
      (await PUT(request("PUT", { id: "id" }), context("accounts"))).status,
    ).toBe(400);
    expect(
      (await POST(request("POST", { name: "x" }), context("accounts"))).status,
    ).toBe(422);
    expect(client.from).not.toHaveBeenCalled();
  });
  it("recusa JSON nulo ou array sem erro interno", async () => {
    expect((await PUT(request("PUT", null), context("accounts"))).status).toBe(
      400,
    );
    expect((await POST(request("POST", []), context("accounts"))).status).toBe(
      400,
    );
  });
  it("geração chama RPC sob a identidade da sessão", async () => {
    client.rpc.mockResolvedValue({ data: 3, error: null });
    const r = await generate(
      new Request("https://meu-norte.test/api/recurrences/generate", {
        method: "POST",
        headers: { origin: "https://meu-norte.test" },
        body: JSON.stringify({ from: "2026-01-01", until: "2026-03-31" }),
      }),
    );
    expect(r.status).toBe(200);
    expect(client.rpc).toHaveBeenCalledWith("generate_recurrences", {
      p_from: "2026-01-01",
      p_until: "2026-03-31",
    });
  });
});
