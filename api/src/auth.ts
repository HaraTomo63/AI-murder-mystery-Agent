import { nowIso } from "./utils";

const encoder = new TextEncoder();

async function hmacSign(secret: string, data: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const signature = await crypto.subtle.sign(
    "HMAC",
    key,
    encoder.encode(data)
  );
  return btoa(String.fromCharCode(...new Uint8Array(signature)))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

export async function createToken(secret: string, payload: Record<string, unknown>) {
  const header = { alg: "HS256", typ: "JWT" };
  const body = {
    ...payload,
    iat: Math.floor(Date.now() / 1000),
  };
  const headerPart = btoa(JSON.stringify(header))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
  const bodyPart = btoa(JSON.stringify(body))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
  const data = `${headerPart}.${bodyPart}`;
  const signature = await hmacSign(secret, data);
  return `${data}.${signature}`;
}

export async function verifyToken(
  secret: string,
  token?: string
): Promise<Record<string, unknown> | null> {
  if (!token) return null;
  const [headerPart, bodyPart, signature] = token.split(".");
  if (!signature) return null;
  const data = `${headerPart}.${bodyPart}`;
  const expected = await hmacSign(secret, data);
  if (expected !== signature) return null;
  try {
    return JSON.parse(atob(bodyPart));
  } catch {
    return null;
  }
}

export function hashPassword(password: string): Promise<string> {
  const data = encoder.encode(password);
  return crypto.subtle.digest("SHA-256", data).then((hash) => {
    return btoa(String.fromCharCode(...new Uint8Array(hash)));
  });
}

export function passwordMatches(hash: string, password: string): Promise<boolean> {
  return hashPassword(password).then((candidate) => candidate === hash);
}

export function newUserId(): string {
  return crypto.randomUUID();
}

export function newSessionId(): string {
  return crypto.randomUUID();
}

export function newMessageId(): string {
  return crypto.randomUUID();
}

export function newSeed(): string {
  return `${Date.now()}-${crypto.randomUUID()}`;
}

export const timestamp = nowIso;
