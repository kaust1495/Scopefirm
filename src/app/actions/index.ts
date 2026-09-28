'use server';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { createQuote, getQuote, reviseQuote, clientAction } from '@/lib/store';
const fields=z.object({client:z.string().trim().min(1).max(120),project:z.string().trim().min(1).max(120),ask:z.string().trim().min(1).max(3000),deliverables:z.string().trim().min(1).max(4000),exclusions:z.string().trim().min(1).max(3000),price:z.coerce.number().int().min(1).max(100000000),revision_limit:z.coerce.number().int().min(0).max(99)});
function input(form:FormData){return fields.parse(Object.fromEntries(['client','project','ask','deliverables','exclusions','price','revision_limit'].map(k=>[k,form.get(k)])));}
export async function makeQuote(form:FormData){const q=await createQuote(input(form)); redirect(`/quotes/${q.id}?key=${q.edit_key}`);}
export async function updateQuote(form:FormData){const id=String(form.get('id')||''),key=String(form.get('key')||''),q=await getQuote(id); if(!q||q.edit_key!==key) throw new Error('Not authorized'); await reviseQuote(q,input(form)); revalidatePath(`/quotes/${id}`);revalidatePath(`/q/${id}`);redirect(`/quotes/${id}?key=${key}`);}
export async function respond(form:FormData){const id=String(form.get('id')||''),kind=String(form.get('kind')||''),note=String(form.get('note')||'').trim(),revision=Number(form.get('revision')); const q=await getQuote(id); if(!q) throw new Error('Quote not found'); if(q.revision!==revision) throw new Error('This quote was revised. Refresh before responding.'); if(kind!=='accepted'&&kind!=='change_requested') throw new Error('Invalid response'); if(kind==='change_requested'&&!note) throw new Error('Describe the requested change'); await clientAction(q,kind,kind==='accepted'?'Client accepted this exact revision':note.slice(0,2000)); revalidatePath(`/quotes/${id}`);revalidatePath(`/q/${id}`);redirect(`/q/${id}`);}
