'use server';

import { attribution } from '@/lib/marketing';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { cookies, headers } from 'next/headers';
import { quoteCurrencies } from '@/lib/currency';
import { gstinPattern } from '@/lib/gst';
import { createQuote, getQuote, reviseQuote, clientAction, deleteQuote, keyMatches, allowEvent, issueAcceptCode, consumeAcceptCode, addChangeOrder, decideChangeOrder, markAdvancePaid, markChangeOrderPaid, isExpired, type QuoteInput } from '@/lib/store';
import { editorCookie, editorCookieOptions } from '@/lib/editor-cookie';
import type { ErrorCode } from '@/lib/errors';
import { emailEnabled, maskEmail, sendApprovalCode } from '@/lib/email';

const fields = z.object({
  client: z.string().trim().min(1).max(120),
  project: z.string().trim().min(1).max(120),
  // The client's original wording is optional context; deliverables and exclusions are the scope.
  ask: z.string().trim().max(3000).nullish().transform(v => v ?? ''),
  deliverables: z.string().trim().min(1).max(4000),
  exclusions: z.string().trim().min(1).max(3000),
  price: z.coerce.number().min(0.01).max(100000000).refine(v => Math.abs(v * 100 - Math.round(v * 100)) < 1e-6, 'Use no more than two decimal places.'),
  currency: z.enum(quoteCurrencies),
  client_email: z.union([z.literal(''), z.email().max(254)]).nullish().transform(v => v ? v.toLowerCase() : null),
  pages_count: z.union([z.literal(''), z.coerce.number().int().min(0).max(1000)]).nullish().transform(v => v === '' || v == null ? null : v),
  forms_count: z.union([z.literal(''), z.coerce.number().int().min(0).max(1000)]).nullish().transform(v => v === '' || v == null ? null : v),
  cms_needed: z.union([z.literal(''), z.enum(['yes', 'no'])]).nullish().transform(v => v === '' || v == null ? null : v),
  timeline: z.string().trim().max(500).nullish().transform(v => v || null),
  supplier_name: z.string().trim().max(120).nullish().transform(v => v || null),
  supplier_address: z.string().trim().max(500).nullish().transform(v => v || null),
  supplier_gstin: z.union([z.literal(''), z.string().trim().regex(gstinPattern, 'Enter a valid 15-character GSTIN.')]).nullish().transform(v => v ? v.toUpperCase() : null),
  client_gstin: z.union([z.literal(''), z.string().trim().regex(gstinPattern, 'Enter a valid 15-character GSTIN.')]).nullish().transform(v => v ? v.toUpperCase() : null),
  sac_code: z.union([z.literal(''), z.string().trim().regex(/^\d{4,8}$/, 'Enter a numeric SAC code.')]).nullish().transform(v => v || null),
  gst_rate: z.union([z.literal(''), z.coerce.number().min(0).max(28).refine(v => Math.abs(v * 100 - Math.round(v * 100)) < 1e-6, 'Use no more than two decimal places.')]).nullish().transform(v => v === '' || v == null ? null : v),
  gst_treatment: z.union([z.literal(''), z.enum(['inclusive', 'exclusive'])]).nullish().transform(v => v === '' || v == null ? null : v),
  gst_split: z.union([z.literal(''), z.enum(['cgst_sgst', 'igst'])]).nullish().transform(v => v === '' || v == null ? null : v),
  upi_id: z.union([z.literal(''), z.string().trim().regex(/^[a-zA-Z0-9._-]{2,64}@[a-zA-Z][a-zA-Z0-9.]{1,64}$/, 'Enter a valid UPI ID like name@bank.')]).nullish().transform(v => v ? v.toLowerCase() : null),
  advance_amount: z.union([z.literal(''), z.coerce.number().min(0.01).max(100000000).refine(v => Math.abs(v * 100 - Math.round(v * 100)) < 1e-6, 'Use no more than two decimal places.')]).nullish().transform(v => v === '' || v == null ? null : v),
  payment_link: z.union([z.literal(''), z.string().trim().max(500).refine(v => { try { const u = new URL(v); return u.protocol === 'https:' && u.hostname.includes('.'); } catch { return false; } }, 'Use an https:// payment link.')]).nullish().transform(v => v || null),
  region: z.enum(['IN', 'OTHER']),
  valid_until: z.union([z.literal(''), z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(v => !Number.isNaN(Date.parse(v)) && v >= '2020-01-01' && v <= '2100-12-31', 'Enter a valid date.')]).nullish().transform(v => v || null),
  revision_limit: z.coerce.number().int().min(0).max(99),
});
// GST rate, treatment and split mean something only as a set: all three or none.
const quoteFields = fields.refine(v => v.advance_amount == null || v.advance_amount <= v.price, 'The advance cannot be more than the price.').refine(v => v.region !== 'IN' || [v.gst_rate, v.gst_treatment, v.gst_split].every(x => x == null) || [v.gst_rate, v.gst_treatment, v.gst_split].every(x => x != null), 'Set the GST rate, treatment and split together, or leave all three empty.')
  // India-only details are dropped for freelancers based elsewhere, and UPI only works for rupee quotes.
  .transform(v => {
    const india = v.region === 'IN';
    return {
      ...v,
      supplier_gstin: india ? v.supplier_gstin : null, client_gstin: india ? v.client_gstin : null, sac_code: india ? v.sac_code : null,
      gst_rate: india ? v.gst_rate : null, gst_treatment: india ? v.gst_treatment : null, gst_split: india ? v.gst_split : null,
      upi_id: india && v.currency === 'INR' ? v.upi_id : null,
    };
  });
const quoteId = z.string().regex(/^[a-f0-9]{24}$/);
const editorKey = z.string().regex(/^[a-f0-9]{48}$/);
const response = z.object({
  id: quoteId,
  kind: z.enum(['accepted', 'change_requested']),
  note: z.string().trim().max(2000),
  name: z.string().trim().max(120),
  code: z.string().trim().max(12),
  revision: z.coerce.number().int().min(1),
}).refine(v => v.kind !== 'change_requested' || v.note.length > 0)
  .refine(v => v.kind !== 'accepted' || v.name.length > 0);
const indiaOnly = ['supplier_gstin', 'client_gstin', 'sac_code', 'gst_rate', 'gst_treatment', 'gst_split', 'upi_id'];
const quoteInput = (form: FormData) => {
  // Hidden India-only inputs still submit; for freelancers based elsewhere they are ignored, not validated.
  const india = form.get('region') === 'IN';
  return quoteFields.safeParse(Object.fromEntries(
    ['client', 'project', 'ask', 'deliverables', 'exclusions', 'price', 'currency', 'client_email', 'pages_count', 'forms_count', 'cms_needed', 'timeline', 'supplier_name', 'supplier_address', 'supplier_gstin', 'client_gstin', 'sac_code', 'gst_rate', 'gst_treatment', 'gst_split', 'upi_id', 'advance_amount', 'payment_link', 'region', 'valid_until', 'revision_limit']
      .map(k => [k, !india && indiaOnly.includes(k) ? null : form.get(k)])
  ));
};
// Only fixed codes travel in the URL; pages map them to their own text (see lib/errors).
const errorUrl = (path: string, code: ErrorCode) => `${path}${path.includes('?') ? '&' : '?'}error=${code}`;
// Vercel sets x-real-ip itself; the first x-forwarded-for value is only a fallback for local runs.
const clientIp = async () => {
  const h = await headers();
  return h.get('x-real-ip')?.trim() || h.get('x-vercel-forwarded-for')?.split(',')[0]?.trim() || h.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
};
// Link holders share a quote, so limit each visitor separately and keep a higher ceiling for the quote as a whole.
const allowClient = async (scope: string, id: string, perVisitor: number, perQuote: number, windowMs: number) =>
  await allowEvent(scope, `${id}:${await clientIp()}`, perVisitor, windowMs) && await allowEvent(`${scope}-quote`, id, perQuote, windowMs);

async function editorFor(form: FormData) {
  const id = quoteId.safeParse(form.get('id'));
  if (!id.success) return null;
  const key = editorKey.safeParse((await cookies()).get(editorCookie(id.data))?.value);
  if (!key.success) return null;
  const q = await getQuote(id.data);
  return q && keyMatches(q, key.data) ? { q, key: key.data } : null;
}

export async function makeQuote(form: FormData) {
  const parsed = quoteInput(form);
  if (!parsed.success) redirect(errorUrl('/', 'fields'));
  if (!await allowEvent('create', await clientIp(), 20, 60 * 60 * 1000)) redirect(errorUrl('/', 'rate'));
  const q = await createQuote(parsed.data, attribution(Object.fromEntries(form)));
  // Set the editor cookie here: a server-action redirect to a route handler renders a 404 in the client router.
  (await cookies()).set(editorCookie(q.id), q.edit_key, editorCookieOptions(q.id));
  redirect(`/quotes/${q.id}?created=1`);
}

export async function updateQuote(form: FormData) {
  const editor = await editorFor(form);
  if (!editor) redirect(errorUrl('/', 'editor'));
  const { q } = editor;
  const tracker = `/quotes/${q.id}`;
  const parsed = quoteInput(form);
  if (!parsed.success) redirect(errorUrl(tracker, 'fields'));
  if (q.status === 'accepted') redirect(errorUrl(tracker, 'locked'));
  try { await reviseQuote(q, parsed.data); }
  catch { redirect(errorUrl(tracker, 'stale')); }
  revalidatePath(tracker);
  revalidatePath(`/q/${q.id}`);
  redirect(tracker);
}

export async function respond(form: FormData) {
  const parsed = response.safeParse({
    id: form.get('id'), kind: form.get('kind'), note: form.get('note') ?? '', name: form.get('name') ?? '', code: form.get('code') ?? '', revision: form.get('revision'),
  });
  if (!parsed.success) {
    const id = quoteId.safeParse(form.get('id'));
    redirect(errorUrl(id.success ? `/q/${id.data}` : '/', 'response'));
  }
  const { id, kind, note, name, code, revision } = parsed.data;
  const clientPage = `/q/${id}`;
  const q = await getQuote(id);
  if (!q) redirect(errorUrl('/', 'missing'));
  if (q.revision !== revision || q.status === 'accepted') redirect(errorUrl(clientPage, 'stale'));
  // Anyone with the link can respond, so cap how fast one quote's history can grow.
  if (!await allowClient('respond', id, 20, 60, 60 * 60 * 1000)) redirect(errorUrl(clientPage, 'rate'));
  if (kind === 'accepted' && isExpired(q)) redirect(errorUrl(clientPage, 'expired'));
  // When the freelancer named the client's email and email is configured, acceptance needs the emailed code.
  const verify = kind === 'accepted' && q.client_email && emailEnabled();
  if (verify && !await consumeAcceptCode(q, code)) redirect(errorUrl(clientPage, 'code'));
  const acceptNote = `Accepted this exact version. Typed name: ${name}.${verify ? ` Verified email: ${maskEmail(q.client_email!)}.` : ''}`;
  try { await clientAction(q, kind, kind === 'accepted' ? acceptNote : note); }
  catch { redirect(errorUrl(clientPage, 'stale')); }
  revalidatePath(`/quotes/${id}`);
  revalidatePath(clientPage);
  redirect(clientPage);
}

export async function removeQuote(form: FormData) {
  const editor = await editorFor(form);
  const confirmation = z.string().max(200).safeParse(form.get('confirmation'));
  if (!editor || !confirmation.success) redirect(errorUrl('/', 'delete'));
  const { q, key } = editor;
  const tracker = `/quotes/${q.id}`;
  if (!await deleteQuote(q.id, key, confirmation.data)) redirect(errorUrl(tracker, 'confirm'));
  (await cookies()).set(editorCookie(q.id), '', { ...editorCookieOptions(q.id), maxAge: 0 });
  revalidatePath(tracker);
  revalidatePath(`/q/${q.id}`);
  redirect(`/?deleted=${q.id}`);
}

const newOrder = z.object({
  title: z.string().trim().min(1).max(120),
  description: z.string().trim().min(1).max(2000),
  price: fields.shape.price,
});
const orderDecision = z.object({ id: quoteId, order_id: quoteId, choice: z.enum(['accepted', 'rejected']) });

export async function proposeChangeOrder(form: FormData) {
  const editor = await editorFor(form);
  if (!editor) redirect(errorUrl('/', 'editor'));
  const { q } = editor;
  const tracker = `/quotes/${q.id}`;
  const parsed = newOrder.safeParse({ title: form.get('title'), description: form.get('description'), price: form.get('price') });
  if (!parsed.success) redirect(errorUrl(tracker, 'order'));
  if (q.status !== 'accepted') redirect(errorUrl(tracker, 'notAccepted'));
  try { await addChangeOrder(q, parsed.data); }
  catch { redirect(errorUrl(tracker, 'stale')); }
  revalidatePath(tracker);
  revalidatePath(`/q/${q.id}`);
  redirect(tracker);
}

export async function respondToChangeOrder(form: FormData) {
  const parsed = orderDecision.safeParse({ id: form.get('id'), order_id: form.get('order_id'), choice: form.get('choice') });
  if (!parsed.success) {
    const id = quoteId.safeParse(form.get('id'));
    redirect(errorUrl(id.success ? `/q/${id.data}` : '/', 'response'));
  }
  const { id, order_id, choice } = parsed.data;
  const clientPage = `/q/${id}`;
  const q = await getQuote(id);
  if (!q) redirect(errorUrl('/', 'missing'));
  if (q.status !== 'accepted') redirect(errorUrl(clientPage, 'notAccepted'));
  // Shares the per-quote budget with other client responses.
  if (!await allowClient('respond', id, 20, 60, 60 * 60 * 1000)) redirect(errorUrl(clientPage, 'rate'));
  if (!await decideChangeOrder(q, order_id, choice)) redirect(errorUrl(clientPage, 'answered'));
  revalidatePath(clientPage);
  revalidatePath(`/quotes/${id}`);
  redirect(clientPage);
}

export async function sendApprovalCodeAction(form: FormData) {
  const id = quoteId.safeParse(form.get('id'));
  if (!id.success) redirect(errorUrl('/', 'response'));
  const clientPage = `/q/${id.data}`;
  const q = await getQuote(id.data);
  if (!q) redirect(errorUrl('/', 'missing'));
  if (q.status === 'accepted' || !q.client_email || !emailEnabled()) redirect(clientPage);
  // Codes go only to the address the freelancer set, so link holders cannot use this to email others.
  // Per visitor, per quote, per recipient address and per IP, so neither one quote nor many quotes can turn this into a mailer.
  const day = 24 * 60 * 60 * 1000;
  if (!await allowClient('code', id.data, 3, 6, 15 * 60 * 1000) || !await allowEvent('code-day', id.data, 10, day)
    || !await allowEvent('code-to', q.client_email.trim().toLowerCase(), 10, day) || !await allowEvent('code-ip', await clientIp(), 20, day)) redirect(errorUrl(clientPage, 'rate'));
  const code = await issueAcceptCode(q);
  if (!code) redirect(`${clientPage}?sent=1`);
  if (!await sendApprovalCode(q.client_email, code)) redirect(errorUrl(clientPage, 'emailFailed'));
  redirect(`${clientPage}?sent=1`);
}

export async function markAdvancePaidAction(form: FormData) {
  const editor = await editorFor(form);
  if (!editor) redirect(errorUrl('/', 'editor'));
  const { q } = editor;
  const tracker = `/quotes/${q.id}`;
  if (q.status !== 'accepted' || q.advance_amount == null || q.advance_paid_at) redirect(tracker);
  try { await markAdvancePaid(q); }
  catch { redirect(errorUrl(tracker, 'stale')); }
  revalidatePath(tracker);
  revalidatePath(`/q/${q.id}`);
  redirect(tracker);
}

export async function markChangeOrderPaidAction(form: FormData) {
  const editor = await editorFor(form);
  if (!editor) redirect(errorUrl('/', 'editor'));
  const { q } = editor;
  const tracker = `/quotes/${q.id}`;
  const orderId = quoteId.safeParse(form.get('order_id'));
  if (!orderId.success) redirect(errorUrl(tracker, 'order'));
  await markChangeOrderPaid(q, orderId.data);
  revalidatePath(tracker);
  revalidatePath(`/q/${q.id}`);
  redirect(tracker);
}

export async function duplicateQuoteAction(form: FormData) {
  const editor = await editorFor(form);
  if (!editor) redirect(errorUrl('/', 'editor'));
  const { q } = editor;
  if (!await allowEvent('create', await clientIp(), 20, 60 * 60 * 1000)) redirect(errorUrl(`/quotes/${q.id}`, 'rate'));
  // Copy the scope and settings; a copy starts as a fresh draft with no dates, views, payments or client email.
  const input: QuoteInput = {
    client: q.client, project: `Copy of ${q.project}`.slice(0, 120), ask: q.ask, deliverables: q.deliverables, exclusions: q.exclusions,
    price: q.price, currency: q.currency, client_email: null, pages_count: q.pages_count, forms_count: q.forms_count, cms_needed: q.cms_needed,
    timeline: q.timeline, supplier_name: q.supplier_name, supplier_address: q.supplier_address, supplier_gstin: q.supplier_gstin,
    client_gstin: q.client_gstin, sac_code: q.sac_code, gst_rate: q.gst_rate, gst_treatment: q.gst_treatment, gst_split: q.gst_split,
    upi_id: q.upi_id, advance_amount: q.advance_amount, payment_link: q.payment_link, region: q.region, valid_until: null, revision_limit: q.revision_limit,
  };
  const copy = await createQuote(input);
  (await cookies()).set(editorCookie(copy.id), copy.edit_key, editorCookieOptions(copy.id));
  redirect(`/quotes/${copy.id}?created=1`);
}

