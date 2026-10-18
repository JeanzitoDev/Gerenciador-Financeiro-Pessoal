import { describe, it, expect } from "vitest";
import fs from "node:fs";
import vm from "node:vm";
import manifest from "../src/app/manifest";
describe("PWA e cache de dados", () => {
  it("manifest possui ícones raster de instalação e máscara", () => {
    const m = manifest();
    expect(m.display).toBe("standalone");
    expect(m.start_url).toBe("/app");
    for (const icon of m.icons!) {
      const bytes = fs.readFileSync(`public${icon.src}`);
      expect(bytes.readUInt32BE(16)).toBe(Number(icon.sizes!.split("x")[0]));
      expect(bytes.readUInt32BE(20)).toBe(Number(icon.sizes!.split("x")[1]));
    }
    expect(m.icons!.some((i) => i.purpose === "maskable")).toBe(true);
  });
  it("service worker não intercepta API, Auth, Supabase, RSC ou escritas", () => {
    const handlers: Record<string, (e: unknown) => void> = {};
    const fetch = () => Promise.resolve("network");
    const context = {
      URL,
      fetch,
      caches: {},
      self: {
        location: { origin: "https://meu-norte.test" },
        addEventListener: (name: string, handler: (e: unknown) => void) => {
          handlers[name] = handler;
        },
      },
    };
    vm.runInNewContext(fs.readFileSync("public/sw.js", "utf8"), context);
    for (const [url, method] of [
      ["https://meu-norte.test/api/data", "GET"],
      ["https://meu-norte.test/api/auth", "POST"],
      ["https://project.supabase.co/rest/v1/transactions", "GET"],
      ["https://meu-norte.test/app?_rsc=private", "GET"],
      ["https://meu-norte.test/auth/callback?code=secret", "GET"],
    ]) {
      let intercepted = false;
      handlers.fetch({
        request: { url, method, mode: "cors" },
        respondWith: () => {
          intercepted = true;
        },
      });
      expect(intercepted).toBe(false);
    }
  });
  it("navegação offline usa somente a página pública, sem armazenar a resposta", async () => {
    const handlers: Record<string, (e: unknown) => void> = {},
      writes: string[] = [];
    let response: Promise<unknown> | undefined;
    const context = {
      URL,
      fetch: () => Promise.reject(new Error("offline")),
      caches: {
        match: async (path: string) => {
          writes.push(path);
          return "offline page";
        },
      },
      self: {
        location: { origin: "https://meu-norte.test" },
        addEventListener: (name: string, handler: (e: unknown) => void) => {
          handlers[name] = handler;
        },
      },
    };
    vm.runInNewContext(fs.readFileSync("public/sw.js", "utf8"), context);
    handlers.fetch({
      request: {
        url: "https://meu-norte.test/app",
        method: "GET",
        mode: "navigate",
      },
      respondWith: (p: Promise<unknown>) => {
        response = p;
      },
    });
    expect(await response).toBe("offline page");
    expect(writes).toEqual(["/offline.html"]);
  });
});
