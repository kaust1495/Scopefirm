'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { cookies } from 'next/headers';
import { createQuote, getQuote, reviseQuote, clientAction, deleteQuote } from '@/lib/store';

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
  revision: z.coerce.number().int().min(1),
}).refine(v => v.kind !== 'change_requested' || v.note.length > 0);
const quoteInput = (form: FormData) => fields.safeParse(Object.fromEntries(
  ['client', 'project', 'ask', 'deliverables', 'exclusions', 'price', 'revision_limit'].map(k => [k, form.get(k)])
));
const errorUrl = (path: string, message: string) => `${path}${path.includes('?') ? '&' : '?'}error=${encodeURIComponent(message)}`;

export async function makeQuote(form: FormData) {
  const parsed = quoteInput(form);
  if (!parsed.success) redirect(errorUrl('/', 'Please check all quote fields and try again.'));
  const q = await createQuote(parsed.data);
  redirect(`/quotes/${q.id}/access?key=${q.edit_key}`);
}

export async function updateQuote(form: FormData) {
  const id = quoteId.safeParse(form.get('id'));
  const key = id.success ? editorKey.safeParse((await cookies()).get(`scopefirm_editor_${id.data}`)?.value) : editorKey.safeParse(null);
  if (!id.success || !key.success) redirect(errorUrl('/', 'Invalid editor link.'));
  const tracker = `/quotes/${id.data}`;
  const q = await getQuote(id.data);
  if (!q || q.edit_key !== key.data) redirect(errorUrl('/', 'Invalid editor link.'));
  const parsed = quoteInput(form);
  if (!parsed.success) redirect(errorUrl(tracker, 'Please check all quote fields and try again.'));
  if (q.status === 'accepted') redirect(errorUrl(tracker, 'This accepted quote is locked.'));
  try { await reviseQuote(q, parsed.data); }
  catch { redirect(errorUrl(tracker, 'The quote changed. Refresh and try again.')); }
  revalidatePath(`/quotes/${id.data}`);
  revalidatePath(`/q/${id.data}`);
  redirect(tracker);
}

export async function respond(form: FormData) {
  const parsed = response.safeParse({
    id: form.get('id'), kind: form.get('kind'), note: form.get('note') ?? '', revision: form.get('revision'),
  });
  if (!parsed.success) redirect(errorUrl('/', 'Invalid client response.'));
  const { id, kind, note, revision } = parsed.data;
  const clientPage = `/q/${id}`;
  const q = await getQuote(id);
  if (!q) redirect(errorUrl('/', 'Quote not found.'));
  if (q.revision !== revision || q.status === 'accepted') redirect(errorUrl(clientPage, 'This quote changed. Refresh before responding.'));
  try { await clientAction(q, kind, kind === 'accepted' ? 'Client accepted this exact revision' : note); }
  catch { redirect(errorUrl(clientPage, 'This quote changed. Refresh before responding.')); }
  revalidatePath(`/quotes/${id}`);
  revalidatePath(clientPage);
  redirect(clientPage);
}

export async function removeQuote(form: FormData) {
  const id = quoteId.safeParse(form.get('id'));
  const key = id.success ? editorKey.safeParse((await cookies()).get(`scopefirm_editor_${id.data}`)?.value) : editorKey.safeParse(null);
  const confirmation = z.string().max(200).safeParse(form.get('confirmation'));
  if (!id.success || !key.success || !confirmation.success) redirect(errorUrl('/', 'Invalid delete request.'));
  const tracker = `/quotes/${id.data}`;
  if (!await deleteQuote(id.data, key.data, confirmation.data)) redirect(errorUrl(tracker, 'Deletion was not confirmed. Type the exact phrase shown.'));
  (await cookies()).set(`scopefirm_editor_${id.data}`, '', {path:`/quotes/${id.data}`,maxAge:0});
  revalidatePath(`/quotes/${id.data}`);
  revalidatePath(`/q/${id.data}`);
  redirect('/?deleted=1');
}
