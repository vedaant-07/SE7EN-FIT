import { createClient } from "npm:@supabase/supabase-js@2";
import { z } from "npm:zod@3";
import { corsHeaders, getIp, json, signToken } from "../_shared/admin.ts";

const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const sessionSecret = Deno.env.get("ADMIN_SESSION_SECRET") ?? "";
const codePepper = Deno.env.get("ACCESS_CODE_PEPPER") ?? "";
const Body = z.object({ code: z.string().trim().min(8).max(128) });
const encoder = new TextEncoder();

function cleanCode(code: string) {
  return code.trim().toUpperCase().replace(/\s+/g, "");
}

async function sha256Hex(value: string) {
  const digest = await crypto.subtle.digest("SHA-256", encoder.encode(value));
  return Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

async function hashCode(code: string) {
  return sha256Hex(`${cleanCode(code)}:${codePepper}`);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  const contentLength = Number(req.headers.get("content-length") || "0");
  if (contentLength > 4096) return json({ ok: false, error: "payload_too_large" }, 413);
  if (!supabaseUrl || !serviceKey || sessionSecret.length < 32) {
    return json({ ok: false, error: "service_not_configured" }, 503);
  }

  const admin = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });
  const ip = getIp(req) || "unknown";
  const rateKey = await sha256Hex(`gym-code:${ip}`);
  const { data: allowed, error: rateError } = await admin.rpc("consume_auth_rate_limit", {
    p_key_hash: rateKey,
    p_scope: "gym_code_validation",
    p_limit: 10,
    p_window_seconds: 900,
    p_block_seconds: 1800,
  });

  if (rateError) {
    console.error("[validate-gym-code] rate-limit error", rateError.message);
    return json({ ok: false, error: "service_unavailable" }, 503);
  }
  if (allowed === false) return json({ ok: false, error: "too_many_attempts" }, 429);

  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return json({ ok: false, error: "invalid_code" }, 400);

  const clean = cleanCode(parsed.data.code);
  const codeHash = await hashCode(clean);
  const { data: codeRow, error: codeError } = await admin
    .from("unique_access_codes")
    .select("id, request_id, status, expires_at, used_at")
    .eq("code_hash", codeHash)
    .maybeSingle();

  if (codeError) {
    console.error("[validate-gym-code] lookup error", codeError.message);
    return json({ ok: false, error: "service_unavailable" }, 503);
  }

  if (!codeRow) {
    await admin.from("audit_logs").insert({
      action: "gym_code.invalid",
      entity_type: "unique_access_code",
      metadata: { fingerprint: codeHash.slice(0, 12) },
      ip,
    });
    return json({ ok: false, error: "invalid_code" }, 200);
  }

  const expired = new Date(codeRow.expires_at).getTime() <= Date.now();
  if (codeRow.used_at || codeRow.status === "used") {
    return json({ ok: false, error: "code_already_used" }, 200);
  }
  if (expired || codeRow.status === "expired") {
    if (codeRow.status === "unused") {
      await admin.from("unique_access_codes").update({ status: "expired" }).eq("id", codeRow.id);
    }
    return json({ ok: false, error: "code_expired" }, 200);
  }
  if (codeRow.status !== "unused") {
    return json({ ok: false, error: "code_not_active" }, 200);
  }

  const { data: request, error: requestError } = await admin
    .from("gym_owner_requests")
    .select("id, gym_name, owner_email, owner_full_name, owner_phone, city, country, gym_type, estimated_members, status")
    .eq("id", codeRow.request_id)
    .maybeSingle();

  if (requestError) {
    console.error("[validate-gym-code] request lookup error", requestError.message);
    return json({ ok: false, error: "service_unavailable" }, 503);
  }
  if (!request || request.status !== "approved") {
    return json({ ok: false, error: "request_not_approved" }, 200);
  }

  const activationToken = await signToken(
    sessionSecret,
    "gym_activation",
    {
      code_id: codeRow.id,
      request_id: request.id,
      email: request.owner_email,
    },
    15 * 60,
  );

  await admin.from("audit_logs").insert({
    action: "gym_code.validated",
    entity_type: "unique_access_code",
    entity_id: codeRow.id,
    metadata: { request_id: request.id },
    ip,
  });

  return json({ ok: true, activation_token: activationToken, expires_in: 900, request });
});
