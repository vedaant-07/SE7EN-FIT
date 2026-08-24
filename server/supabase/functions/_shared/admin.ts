const encoder = new TextEncoder();

function b64urlEncode(bytes: Uint8Array): string {
  const s = btoa(String.fromCharCode(...bytes));
  return s.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function b64urlDecode(s: string): Uint8Array {
  s = s.replace(/-/g, "+").replace(/_/g, "/");
  while (s.length % 4) s += "=";
  return Uint8Array.from(atob(s), (c) => c.charCodeAt(0));
}

async function hmac(secret: string, data: string): Promise<Uint8Array> {
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, encoder.encode(data));
  return new Uint8Array(sig);
}

export function constantTimeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export type TokenKind = "unlock" | "admin_session" | "gym_activation";

export async function signToken(
  secret: string,
  kind: TokenKind,
  payload: Record<string, unknown>,
  ttlSeconds: number,
): Promise<string> {
  if (!secret || secret.length < 32) {
    throw new Error("ADMIN_SESSION_SECRET must be at least 32 characters.");
  }

  const body = {
    k: kind,
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + ttlSeconds,
    ...payload,
  };
  const payloadB64 = b64urlEncode(encoder.encode(JSON.stringify(body)));
  const sig = await hmac(secret, payloadB64);
  return `${payloadB64}.${b64urlEncode(sig)}`;
}

export async function verifyToken(
  secret: string,
  kind: TokenKind,
  token: string,
): Promise<Record<string, unknown> | null> {
  if (!secret || secret.length < 32 || !token || !token.includes(".")) return null;
  const [payloadB64, sigB64] = token.split(".");
  const expected = b64urlEncode(await hmac(secret, payloadB64));
  if (!constantTimeEqual(expected, sigB64)) return null;
  try {
    const body = JSON.parse(new TextDecoder().decode(b64urlDecode(payloadB64)));
    if (body.k !== kind || typeof body.exp !== "number" || body.exp < Math.floor(Date.now() / 1000)) return null;
    return body;
  } catch {
    return null;
  }
}

function configuredOrigin(): string {
  const first = (Deno.env.get("PUBLIC_SITE_URL") || Deno.env.get("ALLOWED_ORIGINS") || "https://se7en.fit")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean)[0];
  return first || "https://se7en.fit";
}

export const corsHeaders = {
  "Access-Control-Allow-Origin": configuredOrigin(),
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-admin-session, x-unlock-token",
  "Access-Control-Allow-Methods": "GET, POST, PATCH, OPTIONS",
  "Vary": "Origin",
};

export function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json",
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
      "X-Frame-Options": "DENY",
      "Referrer-Policy": "no-referrer",
    },
  });
}

export function getIp(req: Request): string | null {
  const cf = req.headers.get("cf-connecting-ip");
  if (cf) return cf.trim();
  const xff = req.headers.get("x-forwarded-for");
  return xff ? xff.split(",")[0].trim() : null;
}
