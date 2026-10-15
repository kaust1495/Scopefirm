// Transactional email for approval and sign-in codes. Enabled only when RESEND_API_KEY and EMAIL_FROM are set.
const apiUrl = () => process.env.EMAIL_API_URL || 'https://api.resend.com/emails';

export const emailEnabled = () => Boolean(process.env.RESEND_API_KEY && process.env.EMAIL_FROM);

/** r•••@studio.com — enough for a client to recognise their address without exposing it to link holders. */
export function maskEmail(email: string) {
  const [user, domain] = email.split('@');
  return `${user.slice(0, 1)}•••@${domain}`;
}

async function send(to: string, subject: string, text: string) {
  if (!emailEnabled()) return false;
  try {
    const res = await fetch(apiUrl(), {
      method: 'POST',
      headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from: process.env.EMAIL_FROM, to: [to], subject, text }),
      signal: AbortSignal.timeout(10000),
    });
    return res.ok;
  } catch {
    return false;
  }
}

// Bodies are fixed text: nothing a quote's author typed goes into these emails, so they cannot carry a lure.
export function sendApprovalCode(to: string, code: string) {
  return send(to, `${code} is your FirmQuote approval code`,
    `Your FirmQuote approval code is ${code}. Enter it on the quote page you have open.\n\nIt expires in 10 minutes. If you did not ask for it, ignore this email; nothing is approved without the code.`);
}

export function sendLoginCode(to: string, code: string) {
  return send(to, `${code} is your FirmQuote sign-in code`,
    `Your FirmQuote sign-in code is ${code}. Enter it on the sign-in page you have open.\n\nIt expires in 10 minutes. If you did not ask for it, ignore this email; nobody can sign in without the code.`);
}
