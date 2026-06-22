/**
 * Turn low-level mailer errors (especially AWS SES) into admin-friendly messages.
 */
export function formatEmailDeliveryError(error: unknown): string {
  const message = extractErrorMessage(error);

  if (
    /AccessDenied/i.test(message) &&
    /ses:Send(Raw)?Email/i.test(message)
  ) {
    const identityMatch = message.match(/identity\/([^'"\s]+)/i);
    const identity = identityMatch?.[1] ?? 'an address in this send';

    return (
      `Email could not be sent: AWS SES denied this send involving ${identity}. ` +
      'While your SES account is in sandbox, both EMAIL_SENDER and the recipient must be verified in eu-west-2. ' +
      'Ensure keel-ses-api allows ses:SendRawEmail (and ses:SendEmail) on identity/ozer.so. ' +
      'Request SES production access to send to any address.'
    );
  }

  if (/MessageRejected/i.test(message) || /Email address is not verified/i.test(message)) {
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

  return message || 'Email could not be sent.';
}

function extractErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }

  if (typeof error === 'object' && error !== null) {
    const record = error as Record<string, unknown>;
    const nested = record.Error;

    if (typeof nested === 'object' && nested !== null && 'Message' in nested) {
      const nestedMessage = (nested as { Message?: unknown }).Message;
      if (typeof nestedMessage === 'string') {
        return nestedMessage;
      }
    }

    if (typeof record.message === 'string') {
      return record.message;
    }
  }

  return String(error);
}
