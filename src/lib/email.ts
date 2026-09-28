// Transactional email for approval codes. Enabled only when RESEND_API_KEY and EMAIL_FROM are set.
const apiUrl = () => process.env.EMAIL_API_URL || 'https://api.resend.com/emails';

export const emailEnabled = () => Boolean(process.env.RESEND_API_KEY && process.env.EMAIL_FROM);

/** r•••@studio.com — enough for a client to recognise their address without exposing it to link holders. */
export function maskEmail(email: string) {
  const [user, domain] = email.split('@');
  return `${user.slice(0, 1)}•••@${domain}`;
}

export async function sendApprovalCode(to: string, code: string, project: string) {
  if (!emailEnabled()) return false;
  try {
    const res = await fetch(apiUrl(), {
      method: 'POST',
      headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: process.env.EMAIL_FROM,
        to: [to],
        subject: `${code} is your ScopeFirm approval code`,
        text: `Your code to approve "${project}" on ScopeFirm is ${code}.\n\nIt expires in 10 minutes. If you did not ask for it, ignore this email; nothing is approved without the code.`,
      }),
      signal: AbortSignal.timeout(10000),
    });
    return res.ok;
  } catch {
    return false;
  }
}
