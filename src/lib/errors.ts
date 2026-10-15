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
  email: 'Enter a valid email address.',
  signinCode: 'That sign-in code is wrong or has expired. Request a new code and try again.',
  signinRate: 'Too many sign-in codes requested. Please wait 15 minutes and try again.',
  signinOff: 'Sign-in is not available right now.',
  signin: 'Sign in to create another quote. Your first quote will be added to your account.',
  limit: 'You have reached your active quote limit. Archive a quote or invite a freelancer to free up room.',
  archive: 'That quote could not be changed. Unarchiving needs a free slot.',
  billingOff: 'Payments are not available right now. Please try again later.',
  billing: 'We could not reach the payment provider. Nothing was charged; please try again in a minute.',
  billingRate: 'Too many checkout attempts. Please wait a while and try again.',
  cancelConfirm: 'Tick the box to confirm you want to cancel.',
  logo: 'Upload a PNG, JPEG or WebP logo of 200 KB or less.',
  brandColor: 'Pick an accent colour like #1f5a41.',
  proOnly: 'Branding is part of Pro.',
} as const;

export type ErrorCode = keyof typeof messages;

export function errorMessage(code: string | undefined) {
  return code && Object.hasOwn(messages, code) ? messages[code as ErrorCode] : undefined;
}
