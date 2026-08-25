type BrevoEmailParams = {
  to: string;
  toName?: string;
  subject: string;
  html: string;
  text: string;
};

export const emailConfig = {
  brevoApiKey: Deno.env.get("BREVO_API_KEY") ?? "",
  fromEmail: Deno.env.get("BREVO_FROM_EMAIL") || Deno.env.get("SE7ENFIT_FROM_EMAIL") || "",
  fromName: Deno.env.get("BREVO_FROM_NAME") || "SE7EN FIT",
  adminNotifyEmail: Deno.env.get("ADMIN_NOTIFY_EMAIL") || Deno.env.get("BREVO_ADMIN_EMAIL") || "",
  publicSiteUrl: (Deno.env.get("PUBLIC_SITE_URL") || "https://se7en.fit").replace(/\/$/, ""),
};

export function escapeHtml(value: string | null | undefined) {
  return String(value ?? "").replace(/[&<>'\"]/g, (c) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    "'": "&#39;",
    '"': "&quot;",
  }[c] ?? c));
}

export function emailShell(title: string, body: string) {
  return `<div style="font-family:Inter,Arial,sans-serif;background:#050505;color:#fff;padding:32px;line-height:1.5"><div style="max-width:680px;margin:0 auto;border:1px solid #222;padding:28px;background:#0b0b0b"><div style="font-weight:800;letter-spacing:1px;margin-bottom:24px">SE7EN<span style="color:#7CFF00">FIT</span></div><h1 style="margin:0 0 14px;font-size:28px;letter-spacing:-0.02em">${title}</h1>${body}<p style="font-size:12px;color:#888;margin-top:28px">This is an automated SE7EN FIT email.</p></div></div>`;
}

export async function sendBrevoEmail(params: BrevoEmailParams) {
  if (!emailConfig.brevoApiKey || !emailConfig.fromEmail) {
    return { sent: false, error: "BREVO_API_KEY or BREVO_FROM_EMAIL is not configured" };
  }

  const res = await fetch("https://api.brevo.com/v3/smtp/email", {
    method: "POST",
    headers: {
      "api-key": emailConfig.brevoApiKey,
      "content-type": "application/json",
      accept: "application/json",
    },
    body: JSON.stringify({
      sender: { email: emailConfig.fromEmail, name: emailConfig.fromName },
      to: [{ email: params.to, name: params.toName || params.to }],
      subject: params.subject,
      htmlContent: params.html,
      textContent: params.text,
    }),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    return { sent: false, error: text || `Brevo API failed with ${res.status}` };
  }
  return { sent: true, error: null };
}
