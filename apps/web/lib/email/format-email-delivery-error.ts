/**
 * Turn low-level mailer errors (ZeptoMail / AWS SES) into admin-friendly messages.
 */
export function formatEmailDeliveryError(error: unknown): string {
  const message = extractErrorMessage(error);
  const haystack = `${message}\n${safeJson(error)}`;

  if (/AccessDenied/i.test(message) && /ses:Send(Raw)?Email/i.test(message)) {
    const identityMatch = message.match(/identity\/([^'"\s]+)/i);
    const identity = identityMatch?.[1] ?? 'an address in this send';

    return (
      `Email could not be sent: AWS SES denied this send involving ${identity}. ` +
      'While your SES account is in sandbox, both EMAIL_SENDER and the recipient must be verified in eu-west-2. ' +
      'Ensure keel-ses-api allows ses:SendRawEmail (and ses:SendEmail) on identity/ozer.so. ' +
      'Request SES production access to send to any address.'
    );
  }

  if (
    /MessageRejected/i.test(message) ||
    /Email address is not verified/i.test(message)
  ) {
    const failedIdentities = message.match(
      /identities failed the check[^:]*:\s*([^\n]+)/i,
    )?.[1];

    if (failedIdentities) {
      return (
        `Email could not be sent: Amazon SES rejected the message because ` +
        `${failedIdentities.trim()} is not verified in SES (eu-west-2). ` +
        'While your account is in the SES sandbox, both the sender and every recipient must be verified. ' +
        'Verify the invitee email in SES, or request production access to send to any address.'
      );
    }

    return (
      'Email could not be sent: Amazon SES rejected the message because an email address is not verified. ' +
      'While your account is in the SES sandbox, both EMAIL_SENDER and the invitee address must be verified in SES. ' +
      'Alternatively, request SES production access.'
    );
  }

  if (/sandbox/i.test(message)) {
    return (
      'Email could not be sent: your Amazon SES account is still in sandbox mode. ' +
      'Verify both the sender and recipient addresses in SES, or request production access.'
    );
  }

  if (/EMAIL_SENDER is not configured/i.test(message)) {
    return message;
  }

  if (
    /Resource Limit Exhausted/i.test(haystack) ||
    /\b429\b/.test(haystack) ||
    /SM_151|SMI_115|LE_102|SM_133/i.test(haystack) ||
    /Per day limit exhausted/i.test(haystack) ||
    /Credit exhausted/i.test(haystack) ||
    /Trial mail sending limit exceeded/i.test(haystack)
  ) {
    return (
      'Email could not be sent: ZeptoMail send limit reached (daily Agent quota or credits). ' +
      'Check ZeptoMail → Settings → Sending limits / credits. Limits usually reset at midnight server time. ' +
      'You can still share the invite link manually.'
    );
  }

  // Prefer ZeptoMail / API details when the top-level message is useless.
  if (!message || message === '[object Object]') {
    return 'Email could not be sent.';
  }

  return message;
}

function safeJson(value: unknown): string {
  try {
    return JSON.stringify(value) ?? '';
  } catch {
    return '';
  }
}

export function extractErrorMessage(error: unknown): string {
  if (typeof error === 'string' && error.trim()) {
    return error;
  }

  if (error instanceof Error) {
    const fromMessage = cleanMessage(error.message);
    if (fromMessage) return fromMessage;

    const withExtras = error as Error & {
      data?: unknown;
      statusCode?: unknown;
      response?: { data?: unknown; status?: unknown };
      cause?: unknown;
    };

    const fromData = stringifyUnknown(withExtras.data);
    if (fromData) return fromData;

    const fromResponse = stringifyUnknown(withExtras.response?.data);
    if (fromResponse) return fromResponse;

    const fromCause = extractErrorMessage(withExtras.cause);
    if (fromCause && fromCause !== '[object Object]') return fromCause;

    return error.name || 'Email could not be sent.';
  }

  if (typeof error === 'object' && error !== null) {
    const record = error as Record<string, unknown>;

    const nested = record.Error;
    if (typeof nested === 'object' && nested !== null && 'Message' in nested) {
      const nestedMessage = (nested as { Message?: unknown }).Message;
      if (typeof nestedMessage === 'string' && nestedMessage.trim()) {
        return nestedMessage;
      }
    }

    for (const key of [
      'message',
      'error',
      'detail',
      'details',
      'code',
    ] as const) {
      const value = record[key];
      if (
        typeof value === 'string' &&
        value.trim() &&
        value !== '[object Object]'
      ) {
        return value;
      }
      if (typeof value === 'object' && value !== null) {
        const nestedMessage = extractErrorMessage(value);
        if (nestedMessage && nestedMessage !== '[object Object]') {
          return nestedMessage;
        }
      }
    }

    const serialized = stringifyUnknown(error);
    if (serialized) return serialized;
  }

  const fallback = String(error);
  return fallback === '[object Object]' ? '' : fallback;
}

function cleanMessage(message: string | undefined): string {
  if (!message?.trim() || message === '[object Object]') {
    return '';
  }
  return message;
}

function stringifyUnknown(value: unknown): string {
  if (value == null) return '';
  if (typeof value === 'string') return cleanMessage(value);
  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }

  try {
    const json = JSON.stringify(value);
    if (!json || json === '{}' || json === 'null') return '';
    return json.length > 800 ? `${json.slice(0, 800)}…` : json;
  } catch {
    return '';
  }
}
