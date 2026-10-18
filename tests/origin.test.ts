import { afterEach, describe, expect, it, vi } from "vitest";
import {
  publicRequestOrigin,
  validatedRequestOrigin,
} from "../src/lib/request-origin";
function request(
  url: string,
  origin?: string,
  host?: string,
  extra: Record<string, string> = {},
) {
  return new Request(url, {
    headers: {
      ...(origin ? { origin } : {}),
      ...(host ? { host } : {}),
      ...extra,
    },
  });
}
afterEach(() => vi.unstubAllEnvs());
describe("origem pública e endereço interno do Next.js", () => {
  it("reproduz e corrige o bind 0.0.0.0 acessado por localhost", () => {
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("APP_ORIGIN", "");
    const r = request(
      "http://0.0.0.0:3000/api/auth",
      "http://localhost:3000",
      "localhost:3000",
    );
    expect(new URL(r.url).origin).not.toBe(r.headers.get("origin"));
    expect(validatedRequestOrigin(r)).toBe("http://localhost:3000");
    expect(publicRequestOrigin(r)).toBe("http://localhost:3000");
  });
  it.each(["localhost", "127.0.0.1", "[::1]", "0.0.0.0"])(
    "aceita alias local %s somente na mesma porta",
    (host) => {
      vi.stubEnv("NODE_ENV", "development");
      vi.stubEnv("APP_ORIGIN", "");
      expect(
        validatedRequestOrigin(
          request("http://0.0.0.0:3001/api/auth", `http://${host}:3001`),
        ),
      ).toBe(`http://${host}:3001`);
      expect(
        validatedRequestOrigin(
          request("http://0.0.0.0:3001/api/auth", `http://${host}:3000`),
        ),
      ).toBeNull();
    },
  );
  it.each([
    "https://evil.test",
    "http://localhost.evil.test:3000",
    "http://localhost:3000@evil.test",
    "https://localhost:3000",
    "null",
    "not-a-url",
    "http://localhost:3000/path",
  ])("bloqueia origem inválida/externa %s", (origin) => {
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("APP_ORIGIN", "");
    expect(
      validatedRequestOrigin(request("http://0.0.0.0:3000/api/auth", origin)),
    ).toBeNull();
  });
  it("origem ausente também é bloqueada", () => {
    vi.stubEnv("APP_ORIGIN", "");
    expect(
      validatedRequestOrigin(request("http://localhost:3000/api/auth")),
    ).toBeNull();
  });
  it("produção não aceita a equivalência de aliases locais", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("APP_ORIGIN", "");
    expect(
      validatedRequestOrigin(
        request("http://0.0.0.0:3000/api/auth", "http://localhost:3000"),
      ),
    ).toBeNull();
    expect(
      validatedRequestOrigin(
        request("https://meu-norte.test/api/auth", "https://meu-norte.test"),
      ),
    ).toBe("https://meu-norte.test");
  });
  it("APP_ORIGIN permite URL pública diferente da URL interna, com comparação estrita", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("APP_ORIGIN", "https://meu-norte.test");
    const r = request(
      "http://internal:3000/api/auth",
      "https://meu-norte.test",
    );
    expect(validatedRequestOrigin(r)).toBe("https://meu-norte.test");
    expect(publicRequestOrigin(r)).toBe("https://meu-norte.test");
    expect(
      validatedRequestOrigin(
        request("http://internal:3000/api/auth", "https://evil.test"),
      ),
    ).toBeNull();
    expect(
      validatedRequestOrigin(
        request("http://internal:3000/api/auth", "http://internal:3000"),
      ),
    ).toBeNull();
  });
  it("não confia em cabeçalhos forwarded para aceitar origens ou redirecionar", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("APP_ORIGIN", "");
    const r = request(
      "https://meu-norte.test/api/auth",
      "https://evil.test",
      "evil.test",
      { "x-forwarded-host": "evil.test", "x-forwarded-proto": "https" },
    );
    expect(validatedRequestOrigin(r)).toBeNull();
    expect(publicRequestOrigin(r)).toBe("https://meu-norte.test");
  });
  it("APP_ORIGIN também é estrita em desenvolvimento", () => {
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("APP_ORIGIN", "http://localhost:3000");
    expect(
      validatedRequestOrigin(
        request("http://0.0.0.0:3000/api/auth", "http://127.0.0.1:3000"),
      ),
    ).toBeNull();
  });
  it("Host externo não vira destino de callback em desenvolvimento", () => {
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("APP_ORIGIN", "");
    expect(
      publicRequestOrigin(
        request("http://0.0.0.0:3000/auth/callback", undefined, "evil.test"),
      ),
    ).toBe("http://0.0.0.0:3000");
  });
});
