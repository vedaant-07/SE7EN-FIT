import express from 'express';
import { createClient } from '@supabase/supabase-js';

const db = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
const fail = (message, status = 400) => Object.assign(new Error(message), { status });
const wrap = (fn) => (req, res) => Promise.resolve(fn(req, res)).catch((err) => res.status(err.status || 500).json({ error: err.message || 'Request failed' }));
const clean = (v) => String(v || '').trim();
const emailRe = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

async function auth(req) {
  const token = String(req.headers.authorization || '').replace(/^Bearer\s+/i, '');
  if (!token) throw fail('Missing bearer token', 401);
  const { data, error } = await db.auth.getUser(token);
  if (error || !data?.user) throw fail('Invalid or expired token', 401);
  return data.user;
}
async function ownerGym(userId) {
  const owned = await db.from('gyms').select('*').eq('owner_user_id', userId).limit(1);
  if (owned.error) throw fail(owned.error.message, 500);
  if (owned.data?.[0]) return owned.data[0];
  const owner = await db.from('gym_owners').select('*, gyms(*)').eq('user_id', userId).limit(1);
  if (owner.error) throw fail(owner.error.message, 500);
  if (owner.data?.[0]?.gyms) return owner.data[0].gyms;
  throw fail('Gym owner access required', 403);
}
async function saveEmail(row) {
  const saved = await db.from('gym_email_messages').insert(row).select('*').single();
  if (saved.error) return null;
  return saved.data;
}
async function sendMailjet({ toEmail, toName, subject, text, gymName }) {
  const key = process.env.MAILJET_API_KEY;
  const secret = process.env.MAILJET_SECRET_KEY;
  const fromEmail = process.env.MAILJET_FROM_EMAIL;
  const fromName = process.env.MAILJET_FROM_NAME || gymName || 'SE7EN FIT';
  if (!key || !secret || !fromEmail) throw fail('Mailjet is not configured on the backend.', 500);
  const authHeader = Buffer.from(`${key}:${secret}`).toString('base64');
  const html = `<div style="font-family:Arial,sans-serif;line-height:1.6;white-space:pre-wrap">${String(text).replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]))}</div>`;
  const response = await fetch('https://api.mailjet.com/v3.1/send', {
    method: 'POST',
    headers: { Authorization: `Basic ${authHeader}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ Messages: [{ From: { Email: fromEmail, Name: fromName }, To: [{ Email: toEmail, Name: toName || toEmail }], Subject: subject, TextPart: text, HTMLPart: html }] }),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw fail(data?.Messages?.[0]?.Errors?.[0]?.ErrorMessage || 'Mailjet send failed.', 400);
  return data;
}
function register(app) {
  if (app.__se7enfitGymOwnerEmailRoutes) return;
  app.__se7enfitGymOwnerEmailRoutes = true;
  app.get('/api/gym-owner/emails', wrap(async (req, res) => {
    const user = await auth(req);
    const gym = await ownerGym(user.id);
    const rows = await db.from('gym_email_messages').select('*').eq('gym_id', gym.gym_id).order('created_at', { ascending: false }).limit(200);
    if (rows.error) return res.json({ items: [] });
    res.json({ items: rows.data || [] });
  }));
  app.post('/api/gym-owner/email/send', wrap(async (req, res) => {
    const user = await auth(req);
    const gym = await ownerGym(user.id);
    const toEmail = clean(req.body?.recipient_email || req.body?.to);
    const toName = clean(req.body?.recipient_name || req.body?.name);
    const subject = clean(req.body?.subject);
    const message = clean(req.body?.message || req.body?.body);
    if (!emailRe.test(toEmail)) throw fail('Valid recipient email is required', 400);
    if (!subject || !message) throw fail('Subject and message are required', 400);
    let status = 'sent';
    let providerPayload = null;
    try {
      providerPayload = await sendMailjet({ toEmail, toName, subject, text: message, gymName: gym.name });
    } catch (err) {
      status = 'failed';
      await saveEmail({ gym_id: gym.gym_id, sent_by: user.id, recipient_email: toEmail, recipient_name: toName || null, subject, body: message, template_name: req.body?.template_name || null, status, error_message: err.message });
      throw err;
    }
    const saved = await saveEmail({ gym_id: gym.gym_id, sent_by: user.id, recipient_email: toEmail, recipient_name: toName || null, subject, body: message, template_name: req.body?.template_name || null, status, provider: 'mailjet', provider_payload: providerPayload });
    res.json({ item: saved || { recipient_email: toEmail, subject, status }, status });
  }));
}
const originalListen = express.application.listen;
express.application.listen = function listenWithGymOwnerEmailRoutes(...args) { register(this); return originalListen.apply(this, args); };
