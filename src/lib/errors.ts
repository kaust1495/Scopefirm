// Pages show only these fixed messages, so a crafted ?error= link cannot put its own text on the page.
const messages = {
  fields: 'Please check all quote fields and try again.',
  editor: 'Invalid editor link.',
  locked: 'This accepted quote is locked.',
  stale: 'This quote changed. Refresh and review the latest version.',
  response: 'Type your name to accept, or describe the change you need.',
  missing: 'Quote not found.',
  rate: 'Too many requests. Please wait a while and try again.',
  delete: 'Invalid delete request.',
  confirm: 'Deletion was not confirmed. Type the exact phrase shown.',
  order: 'Check the change-order fields.',
  notAccepted: 'Accept the original quote before adding work.',
  code: 'That code is wrong or has expired. Request a new code and try again.',
  emailFailed: 'We could not send the code. Please try again in a minute.',
  expired: 'This quote has passed its valid-until date. Ask the freelancer to send an updated version.',
  answered: 'This change order was already answered. Refresh to see its status.',
} as const;

export type ErrorCode = keyof typeof messages;

export function errorMessage(code: string | undefined) {
  return code && Object.hasOwn(messages, code) ? messages[code as ErrorCode] : undefined;
}
