import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders, json, signToken, constantTimeEqual, getIp } from "../_shared/admin.ts";

const encoder = new TextEncoder();
const SESSION_SECRET = Deno.env.get("ADMIN_SESSION_SECRET") ?? "";
const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

// Prefer ADMIN_UNLOCK_QUERY_HASH as an Edge Function secret. The fallback remains
// temporarily for compatibility and must be removed once the production secret is verified.
const FALLBACK_UNLOCK_QUERY_HASH = "d4bdbf9cb6f8012adae098a797d77766f6289bd407d8b785db8f3323ad760f92";
const UNLOCK_QUERY_HASH = Deno.env.get("ADMIN_UNLOCK_QUERY_HASH") || FALLBACK_UNLOCK_QUERY_HASH;

function normalizeQuery(value: string) {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}

async function sha256Hex(value: string) {
  const digest = await crypto.subtle.digest("SHA-256", encoder.encode(value));
  return Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ ok: false, error: "method_not_allowed" }, 405);

  const contentLength = Number(req.headers.get("content-length") || "0");
  if (contentLength > 2048) return json({ ok: false, error: "payload_too_large" }, 413);
  if (!supabaseUrl || !serviceKey || SESSION_SECRET.length < 32) {
    return json({ ok: false, error: "service_not_configured" }, 503);
  }

  const admin = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });
  const ip = getIp(req) || "unknown";
  const rateKey = await sha256Hex(`search-router:${ip}`);
  const { data: allowed, error: rateError } = await admin.rpc("consume_auth_rate_limit", {
    p_key_hash: rateKey,
    p_scope: "admin_search_unlock",
    p_limit: 8,
    p_window_seconds: 900,
    p_block_seconds: 1800,
  });

  if (rateError) {
    console.error("[search-router] rate-limit error", rateError.message);
    return json({ ok: false, error: "service_unavailable" }, 503);
  }
  if (allowed === false) return json({ ok: false, error: "too_many_attempts" }, 429);

  let body: { query?: unknown } = {};
  try {
    body = await req.json();
  } catch {
    return json({ ok: false, error: "bad_request" }, 400);
  }

  const query = typeof body.query === "string" ? normalizeQuery(body.query) : "";
  if (!query || query.length > 200) return json({ ok: false });

  const queryHash = await sha256Hex(query);
  if (!constantTimeEqual(queryHash, UNLOCK_QUERY_HASH)) return json({ ok: false });

  const unlockToken = await signToken(
    SESSION_SECRET,
    "unlock",
    { scope: "admin_search" },
    15 * 60,
  );

  return json({
    ok: true,
    route: "/x7-control/login",
    unlock_token: unlockToken,
    expires_in: 15 * 60,
  });
});
