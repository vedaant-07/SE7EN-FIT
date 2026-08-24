import { createClient } from "npm:@supabase/supabase-js@2";
import { z } from "npm:zod@3";
import { emailConfig, emailShell, escapeHtml, sendBrevoEmail } from "../_shared/email.ts";

function configuredOrigin(): string {
  const first = (Deno.env.get("PUBLIC_SITE_URL") || Deno.env.get("ALLOWED_ORIGINS") || "https://se7en.fit")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean)[0];
  return first || "https://se7en.fit";
}

const corsHeaders = {
  "Access-Control-Allow-Origin": configuredOrigin(),
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Vary": "Origin",
};

const BodySchema = z.object({
  gym_name: z.string().trim().min(2).max(120),
  owner_full_name: z.string().trim().min(2).max(120),
  owner_email: z.string().trim().toLowerCase().email().max(255),
  owner_phone: z.string().trim().max(40).optional().or(z.literal("")),
  city: z.string().trim().max(80).optional().or(z.literal("")),
  country: z.string().trim().max(80).optional().or(z.literal("")),
  gym_type: z.enum(["commercial", "boutique", "crossfit", "studio", "hotel", "corporate", "private", "other"]),
  estimated_members: z.coerce.number().int().min(0).max(1_000_000).optional(),
  current_software: z.string().trim().max(120).optional().or(z.literal("")),
  requirements: z.string().trim().max(2000).optional().or(z.literal("")),
  website: z.string().max(0).optional(),
});

type RequestEmailData = z.infer<typeof BodySchema> & { request_id: string };
const encoder = new TextEncoder();

function json(status: number, body: unknown) {
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

function getIp(req: Request): string | null {
  const cf = req.headers.get("cf-connecting-ip");
  if (cf) return cf.trim();
  const xff = req.headers.get("x-forwarded-for");
  return xff ? xff.split(",")[0].trim() : null;
}

async function sha256Hex(value: string) {
  const digest = await crypto.subtle.digest("SHA-256", encoder.encode(value));
  return Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

async function sendOwnerConfirmation(data: RequestEmailData) {
  const html = emailShell("Gym access request received", `
    <p style="color:#c8c8c8;margin:0 0 18px">Hi ${escapeHtml(data.owner_full_name)},</p>
    <p style="color:#c8c8c8;margin:0 0 18px">We received your SE7EN FIT gym management access request for <strong>${escapeHtml(data.gym_name)}</strong>.</p>
    <p style="color:#c8c8c8;margin:0 0 18px">Our admin team will review your details. If approved, you will receive a unique single-use access code by email.</p>
    <div style="border:1px solid #333;background:#111;padding:14px;margin-top:20px;color:#c8c8c8">
      <div><strong>Request ID:</strong> ${escapeHtml(data.request_id)}</div>
      <div><strong>Status:</strong> Pending review</div>
    </div>`);

  return sendBrevoEmail({
    to: data.owner_email,
    toName: data.owner_full_name,
    subject: "SE7EN FIT gym access request received",
    html,
    text: `We received your SE7EN FIT gym access request for ${data.gym_name}. Request ID: ${data.request_id}. If approved, you will receive a unique access code by email.`,
  });
}

async function sendAdminNotification(data: RequestEmailData) {
  if (!emailConfig.adminNotifyEmail) {
    return { sent: false, error: "ADMIN_NOTIFY_EMAIL is not configured" };
  }

  const html = emailShell("New gym owner request", `
    <p style="color:#c8c8c8;margin:0 0 18px">A new gym owner submitted an access request and is waiting for review.</p>
    <div style="border:1px solid #333;background:#111;padding:16px;color:#c8c8c8">
      <div><strong>Gym:</strong> ${escapeHtml(data.gym_name)}</div>
      <div><strong>Owner:</strong> ${escapeHtml(data.owner_full_name)}</div>
      <div><strong>Email:</strong> ${escapeHtml(data.owner_email)}</div>
      <div><strong>Phone:</strong> ${escapeHtml(data.owner_phone || "-")}</div>
      <div><strong>City:</strong> ${escapeHtml(data.city || "-")}</div>
      <div><strong>Type:</strong> ${escapeHtml(data.gym_type)}</div>
      <div><strong>Members:</strong> ${escapeHtml(String(data.estimated_members ?? "-"))}</div>
    </div>
    ${data.requirements ? `<p style="color:#c8c8c8;margin-top:18px"><strong>Requirements:</strong><br>${escapeHtml(data.requirements)}</p>` : ""}`);

  return sendBrevoEmail({
    to: emailConfig.adminNotifyEmail,
    toName: "SE7EN FIT Admin",
    subject: `New SE7EN FIT gym request: ${data.gym_name}`,
    html,
    text: `New gym request. Gym: ${data.gym_name}. Owner: ${data.owner_full_name}. Email: ${data.owner_email}.`,
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json(405, { error: "Method not allowed" });

  const contentLength = Number(req.headers.get("content-length") || "0");
  if (contentLength > 12_288) return json(413, { error: "Payload too large" });

  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  if (!supabaseUrl || !serviceKey) return json(503, { error: "Service unavailable" });

  const ip = getIp(req) || "unknown";
  const supabase = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });

  const ipRateKey = await sha256Hex(`gym-request:${ip}`);
  const { data: ipAllowed, error: rateError } = await supabase.rpc("consume_auth_rate_limit", {
    p_key_hash: ipRateKey,
    p_scope: "gym_request_submission",
    p_limit: 10,
    p_window_seconds: 3600,
    p_block_seconds: 3600,
  });

  if (rateError) {
    console.error("[submit-gym-request] rate-limit error", rateError.message);
    return json(503, { error: "Service unavailable" });
  }
  if (ipAllowed === false) {
    return json(429, { error: "Too many applications from this network. Please try later." });
  }

  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return json(400, { error: "Invalid JSON" });
  }

  const parsed = BodySchema.safeParse(raw);
  if (!parsed.success) {
    return json(400, { error: "Validation failed", details: parsed.error.flatten().fieldErrors });
  }
  const data = parsed.data;

  const emailRateKey = await sha256Hex(`gym-request-email:${data.owner_email}`);
  const { data: emailAllowed, error: emailRateError } = await supabase.rpc("consume_auth_rate_limit", {
    p_key_hash: emailRateKey,
    p_scope: "gym_request_email",
    p_limit: 3,
    p_window_seconds: 3600,
    p_block_seconds: 3600,
  });

  if (emailRateError) {
    console.error("[submit-gym-request] email rate-limit error", emailRateError.message);
    return json(503, { error: "Service unavailable" });
  }
  if (emailAllowed === false) {
    return json(429, { error: "Too many recent applications. Please contact support@se7en.fit." });
  }

  const { data: inserted, error } = await supabase
    .from("gym_owner_requests")
    .insert({
      gym_name: data.gym_name,
      owner_full_name: data.owner_full_name,
      owner_email: data.owner_email,
      owner_phone: data.owner_phone || null,
      city: data.city || null,
      country: data.country || null,
      gym_type: data.gym_type,
      estimated_members: data.estimated_members ?? null,
      current_software: data.current_software || null,
      requirements: data.requirements || null,
      source_ip: ip === "unknown" ? null : ip,
      status: "pending",
    })
    .select("id, created_at")
    .single();

  if (error) {
    console.error("[submit-gym-request] insert error", error.message);
    return json(500, { error: "Could not save your application. Try again shortly." });
  }

  const emailData = { ...data, request_id: inserted.id };
  const [ownerEmail, adminEmail] = await Promise.all([
    sendOwnerConfirmation(emailData),
    sendAdminNotification(emailData),
  ]);

  await supabase.from("audit_logs").insert({
    actor_id: null,
    action: "gym_request.submitted",
    entity_type: "gym_owner_request",
    entity_id: inserted.id,
    metadata: {
      gym_name: data.gym_name,
      owner_email: data.owner_email,
      owner_confirmation_sent: ownerEmail.sent,
      owner_confirmation_error: ownerEmail.error,
      admin_notification_sent: adminEmail.sent,
      admin_notification_error: adminEmail.error,
    },
    ip: ip === "unknown" ? null : ip,
  });

  return json(200, {
    ok: true,
    request_id: inserted.id,
    submitted_at: inserted.created_at,
    owner_confirmation_sent: ownerEmail.sent,
    admin_notification_sent: adminEmail.sent,
  });
});
