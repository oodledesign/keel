/**
 * Turn low-level mailer errors (especially AWS SES) into admin-friendly messages.
 */
export function formatEmailDeliveryError(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);

  if (/AccessDenied/i.test(message) && /ses:SendEmail/i.test(message)) {
    const identityMatch = message.match(/identity\/([^'"\s]+)/i);
    const identity = identityMatch?.[1] ?? 'the configured sender address';

    return (
      `Email could not be sent: AWS SES denied access to send from ${identity}. ` +
      'Update the IAM policy for your SES user to allow ses:SendEmail on that identity, ' +
      'or change the Vercel EMAIL_SENDER variable to a verified address your SES user can use.'
    );
  }

  if (/Email address is not verified/i.test(message)) {
    return (
      'Email could not be sent: the sender address is not verified in Amazon SES. ' +
      'Verify the address or domain in SES, then update EMAIL_SENDER in Vercel.'
    );
  }

  if (/EMAIL_SENDER is not configured/i.test(message)) {
    return message;
  }

  return message || 'Email could not be sent.';
}
