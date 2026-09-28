// One source for the FAQ page, its FAQPage structured data and llms.txt.
export type Faq = { q: string; a: string };

export const faqs: { group: string; items: Faq[] }[] = [
  { group: 'Getting started', items: [
    { q: 'Who is ScopeFirm for?', a: 'Freelance web designers and developers who quote fixed prices to clients they find themselves (referrals, LinkedIn, local businesses) and want the client to agree to exact deliverables, exclusions and revision rounds before work starts.' },
    { q: 'Do I or my client need an account?', a: 'No. Each quote gets a private editor link for you and a client link for your client. Save your editor link: it is the only way back in from another device. This browser stays signed in to a quote for 30 days.' },
    { q: 'Is it free?', a: 'Yes. ScopeFirm is a free prototype. There are no paid plans, and it never takes a cut of your payments.' },
    { q: 'Which countries and currencies does it support?', a: 'It works everywhere. Choose India or Elsewhere on each quote: India adds GST details and UPI payments. Quotes can be in INR, USD, EUR or GBP, with no automatic currency conversion. Times are shown in each viewer’s own timezone.' },
  ] },
  { group: 'Approval and scope', items: [
    { q: 'What does the client’s approval record?', a: 'Which version of the quote was accepted, when, and the name the client typed. If you add the client’s email and email verification is switched on, the client must also enter a code sent to that address.' },
    { q: 'Is an approval a legal signature?', a: 'No. It is a dated record of agreement, not a verified electronic signature, a contract by itself, or proof of payment. Agree your contract terms directly with your client.' },
    { q: 'Can I change a quote after sending it?', a: 'Yes, until the client accepts it. Each save creates a new version, and the client can only accept the latest one. Earlier versions stay in the history.' },
    { q: 'What happens when the client asks for extra work?', a: 'An accepted quote is locked. You propose each extra as a priced change order; the client accepts or declines it on the same link, and only accepted changes add to the running total.' },
    { q: 'Can a quote expire?', a: 'Yes. Set an optional “valid until” date. After it passes, the client can no longer accept that version but can still ask for changes, and you can send an updated one.' },
    { q: 'Will I know if the client opened the quote?', a: 'The tracker shows how many times the client link was opened and when. Common link previews in WhatsApp or Slack and your own preview are filtered out. Someone deliberately disguising their browser may still be counted. It shows the link was opened, not who opened it.' },
  ] },
  { group: 'Payments and records', items: [
    { q: 'How does my client pay the advance or a change order?', a: 'You add a payment link (PayPal.me, Stripe, Razorpay, Wise or any https link) and, if you are in India quoting in rupees, a UPI ID. The client pays you directly. ScopeFirm never handles or verifies money; you mark payments received yourself.' },
    { q: 'What if my client is outside India?', a: 'Use a payment link. Most clients outside India cannot pay by UPI, so ScopeFirm only shows UPI for India-based rupee quotes.' },
    { q: 'Can I track what I am owed?', a: 'Yes. Download the Excel payments sheet from a quote or from “Your recent quotes”. It lists each client, the total agreed, what you marked received, the balance and a follow-up date, with overdue items highlighted.' },
    { q: 'Can ScopeFirm remind me to chase a payment?', a: 'Yes. For any unpaid advance or change order, download a calendar reminder (.ics) and open it in Google Calendar, Outlook or Apple Calendar.' },
    { q: 'Can I get a PDF?', a: 'Yes. Open the printable quotation from the tracker and save it as PDF. It is a quotation, not a tax invoice; with GST details it shows the tax breakup.' },
  ] },
  { group: 'Privacy and security', items: [
    { q: 'Who can see my quote?', a: 'Anyone with the client link can read and respond to it, so share it only with your client. Anyone with your private editor link can edit or delete the quote. Quote pages are hidden from search engines.' },
    { q: 'Can I delete my data?', a: 'Yes. From the tracker you can download a copy and permanently delete the quote with its history and change orders.' },
    { q: 'How do I report a bug or a security issue?', a: 'Open an issue on GitHub from the Support page. For a security problem, use GitHub’s private vulnerability reporting instead of a public issue.' },
  ] },
];

export const allFaqs = faqs.flatMap(g => g.items);
