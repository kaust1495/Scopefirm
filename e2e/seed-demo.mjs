// Seeds one realistic quote on a local server for marketing screenshots. Prints ids and the editor cookie.
import { Visitor, quoteId } from './harness.mjs';

const forms = html => [...html.matchAll(/<form\b[^>]*>([\s\S]*?)<\/form>/g)].map(m => m[0]).filter(f => f.includes('$ACTION_ID_'))
  .map(f => `[${[...f.matchAll(/<button[^>]*>([\s\S]*?)<\/button>/g)].map(m => m[1].replace(/<[^>]+>/g, '').trim()).join('|')}] ${[...new Set([...f.matchAll(/name="([^"$]+)"/g)].map(m => m[1]))].join(',')}`);

const fl = new Visitor('10.77.0.1'), client = new Visitor('10.77.0.2');
const step = async (label, p) => { const r = await p; console.log(`${label}: ${r.status} ${r.location ?? ''}`); return r; };

const created = await step('create', fl.submit('/', 'name="client"', {
  client: 'Riya Mehta, Studio North', project: 'Portfolio website redesign', region: 'IN', currency: 'INR', price: '48000', revision_limit: '2',
  ask: 'Need a fresh portfolio site to show our interior projects, with an enquiry form.',
  deliverables: 'Responsive 5-page website (Home, About, Projects, Services, Contact)\nProject gallery with 12 case studies\nEnquiry form with email notifications\nBasic on-page SEO and Google Analytics\nLaunch support for 2 weeks',
  exclusions: 'Copywriting and photography\nDomain and hosting fees\nPages beyond the five listed\nOngoing maintenance after launch',
  timeline: '3 weeks after kickoff', pages_count: '5', forms_count: '1', cms_needed: 'no',
  supplier_name: 'Asha Iyer Design', supplier_gstin: '27AAPFU0939F1ZV', sac_code: '998314', gst_rate: '18', gst_treatment: 'exclusive', gst_split: 'igst',
  upi_id: 'asha.design@okhdfcbank', advance_amount: '19200',
}));
const id = quoteId(created.location);
await step('accept', client.submit(`/q/${id}`, 'Accept version', { name: 'Riya Mehta' }));
await step('advance received', fl.submit(`/quotes/${id}`, 'Mark advance as received', { confirm: 'RECEIVED' }));
await step('change: blog', fl.submit(`/quotes/${id}`, 'Propose change order', { title: 'Blog section with 3 starter posts', description: 'Add a blog listing page and template, and set up three posts from the copy you supply.', price: '12000', advance_amount: '6000' }));
await step('change: booking', fl.submit(`/quotes/${id}`, 'Propose change order', { title: 'Consultation booking page', description: 'A booking page linked to your Calendly, with a confirmation email.', price: '7500' }));
const clientPage = (await client.get(`/q/${id}`)).body;
console.log('client forms:\n  ' + forms(clientPage).join('\n  '));
const blogOrder = /name="order_id" value="([a-f0-9]{24})"/.exec(clientPage)?.[1];
const accept = forms(clientPage).find(f => f.startsWith('[Accept change'));
if (blogOrder && accept) {
  const fields = { order_id: blogOrder, choice: 'accepted' };
  if (accept.includes('name')) fields.name = 'Riya Mehta';
  if (accept.includes('confirm')) fields.confirm = 'Riya Mehta';
  await step('client accepts blog change', client.submit(`/q/${id}`, new RegExp(`value="${blogOrder}"[\\s\\S]*Accept change`), fields));
}
console.log(JSON.stringify({ id, editor: fl.jar.get(`scopefirm_editor_${id}|/quotes/${id}`) ?? [...fl.jar.values()].find(c => c.name.startsWith('scopefirm_editor_')) }));
