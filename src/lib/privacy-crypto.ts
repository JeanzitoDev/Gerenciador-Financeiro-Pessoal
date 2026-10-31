import {
  createCipheriv,
  createDecipheriv,
  createHmac,
  randomBytes,
} from "node:crypto";

const ENTITY_TEXT_FIELDS: Record<string, Record<string, number>> = {
  accounts: { name: 80, institution: 80 },
  transactions: { description: 140 },
  goals: { name: 80 },
  contributions: { note: 200 },
  investments: { name: 80 },
  recurrences: { description: 140 },
  loans: { name: 80, institution: 80 },
};

function deriveKeys(userId: string): Buffer[] {
  const envSecret = process.env.FIELD_ENCRYPTION_KEY?.trim() ?? "";
  const primary = createHmac(
    "sha256",
    `meunorte:field-shield:v1:${envSecret}`,
  )
    .update(userId)
    .digest();
  if (!envSecret) return [primary];
  const fallback = createHmac("sha256", "meunorte:field-shield:v1:")
    .update(userId)
    .digest();
  return [primary, fallback];
}

function truncateUtf8Bytes(input: string, maxBytes: number): string {
  if (Buffer.byteLength(input, "utf8") <= maxBytes) return input;
  let out = "";
  let used = 0;
  for (const ch of input) {
    const len = Buffer.byteLength(ch, "utf8");
    if (used + len > maxBytes) break;
    out += ch;
    used += len;
  }
  return out;
}

export function obfuscateText(
  text: string,
  userId: string,
  maxLen = 140,
  force = false,
): string {
  if (
    !force &&
    process.env.VITEST === "true" &&
    process.env.FORCE_PRIVACY_CRYPTO !== "true"
  ) {
    return text;
  }
  if (!text || !text.trim() || !userId || text.startsWith("enc:")) {
    return text;
  }
  const maxPlainBytes = Math.max(8, Math.floor(((maxLen - 4) * 3) / 4) - 5);
  const cleanPlain = truncateUtf8Bytes(text.trim(), maxPlainBytes);
  const plainBuf = Buffer.from(cleanPlain, "utf8");
  const [key] = deriveKeys(userId);
  const nonce = randomBytes(3);
  const iv = Buffer.concat([nonce, Buffer.alloc(13)]);
  const cipher = createCipheriv("aes-256-ctr", key, iv);
  const ciphertext = Buffer.concat([cipher.update(plainBuf), cipher.final()]);
  const tag = createHmac("sha256", key)
    .update(nonce)
    .update(ciphertext)
    .digest()
    .subarray(0, 2);
  const token = `enc:${Buffer.concat([nonce, tag, ciphertext]).toString("base64url")}`;
  return token.length <= maxLen ? token : text;
}

function decryptTokenPayload(b64Payload: string, userId: string): string | null {
  try {
    const buf = Buffer.from(b64Payload, "base64url");
    if (buf.length < 6) return null;
    const nonce = buf.subarray(0, 3);
    const tag = buf.subarray(3, 5);
    const ciphertext = buf.subarray(5);
    const iv = Buffer.concat([nonce, Buffer.alloc(13)]);
    for (const key of deriveKeys(userId)) {
      const expectedTag = createHmac("sha256", key)
        .update(nonce)
        .update(ciphertext)
        .digest()
        .subarray(0, 2);
      if (
        expectedTag[0] === tag[0] &&
        expectedTag[1] === tag[1]
      ) {
        const decipher = createDecipheriv("aes-256-ctr", key, iv);
        const plainBuf = Buffer.concat([
          decipher.update(ciphertext),
          decipher.final(),
        ]);
        return plainBuf.toString("utf8");
      }
    }
    return null;
  } catch {
    return null;
  }
}

export function deobfuscateText(text: string, userId: string): string {
  if (!text || !userId || !text.includes("enc:")) return text;
  return text.replace(/\benc:([A-Za-z0-9_-]+)/g, (fullMatch, b64Payload) => {
    const decoded = decryptTokenPayload(b64Payload, userId);
    return decoded !== null ? decoded : fullMatch;
  });
}

export function obfuscateRecordPayload<T extends Record<string, unknown>>(
  entity: string,
  payload: T,
  userId: string,
  force = false,
): T {
  const fields = ENTITY_TEXT_FIELDS[entity];
  if (!fields || !userId) return payload;
  const copy: Record<string, unknown> = { ...payload };
  for (const [field, maxLen] of Object.entries(fields)) {
    const val = copy[field];
    if (typeof val === "string" && val.trim().length > 0) {
      copy[field] = obfuscateText(val, userId, maxLen, force);
    }
  }
  return copy as T;
}

export function deobfuscateRecordRow<T extends Record<string, unknown>>(
  entity: string,
  row: T,
  userId: string,
): T {
  const fields = ENTITY_TEXT_FIELDS[entity];
  if (!fields || !userId) return row;
  let changed = false;
  const copy: Record<string, unknown> = { ...row };
  for (const field of Object.keys(fields)) {
    const val = copy[field];
    if (typeof val === "string" && val.includes("enc:")) {
      const decoded = deobfuscateText(val, userId);
      if (decoded !== val) {
        copy[field] = decoded;
        changed = true;
      }
    }
  }
  return changed ? (copy as T) : row;
}

