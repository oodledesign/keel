import type { IgCollectField } from './step-types';

export type CollectValidation = { ok: true; value: string } | { ok: false };

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export function normaliseEmail(input: string): string | null {
  const email = input.trim().toLowerCase();
  return EMAIL_RE.test(email) && email.length <= 254 ? email : null;
}

/**
 * Normalise to E.164, assuming UK numbers when no country code is given
 * (07… → +447…, 01/02/03… → +441…/+442…/+443…).
 */
export function normaliseUkPhone(input: string): string | null {
  const raw = input.trim().replace(/[\s().-]/g, '');
  if (!raw) return null;

  let digits: string;
  if (raw.startsWith('+')) {
    digits = raw.slice(1);
  } else if (raw.startsWith('00')) {
    digits = raw.slice(2);
  } else if (raw.startsWith('0')) {
    digits = `44${raw.slice(1)}`;
  } else if (raw.startsWith('44')) {
    digits = raw;
  } else {
    return null;
  }

  if (!/^\d+$/.test(digits)) return null;

  if (digits.startsWith('44')) {
    const national = digits.slice(2).replace(/^0/, '');
    // UK numbers are 10 digits after the country code (9 for a few legacy ranges).
    if (national.length < 9 || national.length > 10) return null;
    return `+44${national}`;
  }

  return digits.length >= 8 && digits.length <= 15 ? `+${digits}` : null;
}

const YES = new Set([
  'yes',
  'y',
  'yeah',
  'yep',
  'ok',
  'okay',
  'i agree',
  'agree',
  'sure',
]);
const NO = new Set(['no', 'n', 'nope', 'no thanks', 'no thank you']);

export function parseConsentAnswer(input: string): boolean | null {
  const answer = input
    .trim()
    .toLowerCase()
    .replace(/[^a-z ]/g, '')
    .trim();
  if (YES.has(answer) || answer.startsWith('yes')) return true;
  if (NO.has(answer) || answer.startsWith('no')) return false;
  return null;
}

export function validateCollectedValue(
  field: IgCollectField,
  input: string,
): CollectValidation {
  const text = input.trim();
  switch (field) {
    case 'email': {
      const email = normaliseEmail(text);
      return email ? { ok: true, value: email } : { ok: false };
    }
    case 'phone': {
      const phone = normaliseUkPhone(text);
      return phone ? { ok: true, value: phone } : { ok: false };
    }
    case 'name': {
      const name = text.replace(/\s+/g, ' ');
      return name.length >= 1 &&
        name.length <= 80 &&
        /\p{L}/u.test(name) &&
        !/[@<>{}]/.test(name)
        ? { ok: true, value: name }
        : { ok: false };
    }
    case 'consent': {
      const consent = parseConsentAnswer(text);
      return consent === null
        ? { ok: false }
        : { ok: true, value: consent ? 'yes' : 'no' };
    }
    case 'text':
      return text.length >= 1 && text.length <= 500
        ? { ok: true, value: text }
        : { ok: false };
  }
}

export const DEFAULT_RETRY_PROMPTS: Record<IgCollectField, string> = {
  email:
    "That doesn't look like an email address. Could you send it again? (e.g. name@example.co.uk)",
  phone:
    "That doesn't look like a phone number. Could you send it again? (e.g. 07700 900123)",
  name: 'Sorry, I didn’t catch that. What’s your name?',
  text: 'Sorry, could you send that again?',
  consent: 'Please tap "Yes, I agree" or "No thanks".',
};
