'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { cookies, headers } from 'next/headers';
import { createQuote, getQuote, reviseQuote, clientAction, deleteQuote, keyMatches, allowEvent } from '@/lib/store';
import { editorCookie, editorCookieOptions } from '@/lib/editor-cookie';
import type { ErrorCode } from '@/lib/errors';

const fields = z.object({
  client: z.string().trim().min(1).max(120),
  project: z.string().trim().min(1).max(120),
  ask: z.string().trim().min(1).max(3000),
  deliverables: z.string().trim().min(1).max(4000),
  exclusions: z.string().trim().min(1).max(3000),
  price: z.coerce.number().int().min(1).max(100000000),
  revision_limit: z.coerce.number().int().min(0).max(99),
});
const quoteId = z.string().regex(/^[a-f0-9]{24}$/);
const editorKey = z.string().regex(/^[a-f0-9]{48}$/);
const response = z.object({
  id: quoteId,
  kind: z.enum(['accepted', 'change_requested']),
  note: z.string().trim().max(2000),
  name: z.string().trim().max(120),
  revision: z.coerce.number().int().min(1),
}).refine(v => v.kind !== 'change_requested' || v.note.length > 0)
  .refine(v => v.kind !== 'accepted' || v.name.length > 0);
const quoteInput = (form: FormData) => fields.safeParse(Object.fromEntries(
  ['client', 'project', 'ask', 'deliverables', 'exclusions', 'price', 'revision_limit'].map(k => [k, form.get(k)])
));
// Only fixed codes travel in the URL; pages map them to their own text (see lib/errors).
const errorUrl = (path: string, code: ErrorCode) => `${path}${path.includes('?') ? '&' : '?'}error=${code}`;
const clientIp = async () => (await headers()).get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';

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
  const q = await createQuote(parsed.data);
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
    id: form.get('id'), kind: form.get('kind'), note: form.get('note') ?? '', name: form.get('name') ?? '', revision: form.get('revision'),
  });
  if (!parsed.success) {
    const id = quoteId.safeParse(form.get('id'));
    redirect(errorUrl(id.success ? `/q/${id.data}` : '/', 'response'));
  }
  const { id, kind, note, name, revision } = parsed.data;
  const clientPage = `/q/${id}`;
  const q = await getQuote(id);
  if (!q) redirect(errorUrl('/', 'missing'));
  if (q.revision !== revision || q.status === 'accepted') redirect(errorUrl(clientPage, 'stale'));
  // Anyone with the link can respond, so cap how fast one quote's history can grow.
  if (!await allowEvent('respond', id, 20, 60 * 60 * 1000)) redirect(errorUrl(clientPage, 'rate'));
  try { await clientAction(q, kind, kind === 'accepted' ? `Accepted this exact revision. Typed name: ${name}` : note); }
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
  redirect('/?deleted=1');
}
