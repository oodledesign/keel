const OPT_OUT_PHRASES = new Set([
  'stop',
  'unsubscribe',
  'stop messages',
  'stop all',
  'opt out',
]);
const OPT_IN_PHRASES = new Set(['start', 'subscribe', 'unstop']);

function normalise(text: string) {
  return text
    .trim()
    .toLowerCase()
    .replace(/[^\p{L}\p{N} ]/gu, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Whole-message match only, so "don't stop" or "stop by Friday?" never opt out. */
export function isOptOutMessage(text: string | null | undefined): boolean {
  return Boolean(text) && OPT_OUT_PHRASES.has(normalise(text!));
}

export function isOptInMessage(text: string | null | undefined): boolean {
  return Boolean(text) && OPT_IN_PHRASES.has(normalise(text!));
}

export const OPT_OUT_CONFIRMATION =
  "You're unsubscribed and won't get any more automated messages from us. Reply START if you change your mind.";

export const OPT_IN_CONFIRMATION =
  "Welcome back! You'll get our automated messages again. Reply STOP at any time to unsubscribe.";
