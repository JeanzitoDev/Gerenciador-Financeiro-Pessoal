/** Explicit public URL for deployments behind a proxy; never trust forwarded headers blindly. */
function configuredOrigin(): string | null {
  const value = process.env.APP_ORIGIN?.trim();
  if (!value) return null;
  const url = new URL(value);
  if (
    !["http:", "https:"].includes(url.protocol) ||
    url.username ||
    url.password ||
    url.pathname !== "/" ||
    url.search ||
    url.hash
  ) {
    throw new Error(
      "APP_ORIGIN deve conter somente protocolo, hostname e porta.",
    );
  }
  return url.origin;
}
const loopbacks = new Set(["localhost", "127.0.0.1", "[::1]", "0.0.0.0"]);
function sameLocalServer(a: URL, b: URL): boolean {
  return (
    process.env.NODE_ENV === "development" &&
    loopbacks.has(a.hostname) &&
    loopbacks.has(b.hostname) &&
    a.protocol === b.protocol &&
    a.port === b.port
  );
}
export function publicRequestOrigin(request: Request): string {
  const explicit = configuredOrigin();
  if (explicit) return explicit;
  const internal = new URL(request.url);
  // Next can construct request.url from the --hostname bind address (0.0.0.0).
  // In development, preserve the browser-visible local host for callback redirects.
  const host = request.headers.get("host");
  if (host && process.env.NODE_ENV === "development") {
    try {
      const visible = new URL(`${internal.protocol}//${host}`);
      if (visible.host === host && sameLocalServer(internal, visible))
        return visible.origin;
    } catch {
      /* Invalid Host does not become a trusted redirect target. */
    }
  }
  return internal.origin;
}
export function validatedRequestOrigin(request: Request): string | null {
  const raw = request.headers.get("origin");
  if (!raw || raw === "null") return null;
  let candidate: URL;
  try {
    candidate = new URL(raw);
  } catch {
    return null;
  }
  if (
    !["http:", "https:"].includes(candidate.protocol) ||
    candidate.origin !== raw
  )
    return null;
  if (candidate.origin === publicRequestOrigin(request))
    return candidate.origin;
  // Local aliases are equivalent only in development, on the same protocol and port.
  // An explicitly configured APP_ORIGIN always takes precedence and stays strict.
  if (!configuredOrigin() && sameLocalServer(candidate, new URL(request.url)))
    return candidate.origin;
  return null;
}
