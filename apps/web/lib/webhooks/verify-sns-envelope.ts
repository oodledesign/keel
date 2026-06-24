import 'server-only';

import { createVerify, X509Certificate } from 'node:crypto';

const SNS_HOST_PATTERN =
  /^https:\/\/sns\.[a-z0-9-]+\.amazonaws\.com(\.cn)?\//i;

type SnsEnvelope = Record<string, string>;

function buildStringToSign(message: SnsEnvelope, type: string): string {
  const fields =
    type === 'Notification'
      ? ['Message', 'MessageId', 'Subject', 'Timestamp', 'TopicArn', 'Type']
      : [
          'Message',
          'MessageId',
          'SubscribeURL',
          'Timestamp',
          'Token',
          'TopicArn',
          'Type',
        ];

  let result = '';

  for (const field of fields) {
    const value = message[field];
    if (value === undefined || value === null || value === '') {
      continue;
    }

    result += `${field}\n${value}\n`;
  }

  return result;
}

function assertSigningCertUrl(url: string) {
  if (!SNS_HOST_PATTERN.test(url)) {
    throw new Error('Invalid SNS signing certificate URL');
  }
}

async function fetchSigningCertificate(url: string): Promise<string> {
  assertSigningCertUrl(url);

  const response = await fetch(url, { cache: 'no-store' });

  if (!response.ok) {
    throw new Error('Failed to download SNS signing certificate');
  }

  const pem = await response.text();
  // Validate PEM parses before use.
  new X509Certificate(pem);
  return pem;
}

/**
 * Verifies an AWS SNS envelope (SubscriptionConfirmation / Notification).
 * @see https://docs.aws.amazon.com/sns/latest/dg/sns-verify-signature-of-message.html
 */
export async function verifySnsEnvelope(
  envelope: Record<string, unknown>,
): Promise<void> {
  const type = String(envelope.Type ?? '');
  const signature = String(envelope.Signature ?? '');
  const signatureVersion = String(envelope.SignatureVersion ?? '');
  const signingCertUrl = String(envelope.SigningCertURL ?? '');

  if (!type || !signature || !signatureVersion || !signingCertUrl) {
    throw new Error('Missing SNS signature fields');
  }

  if (signatureVersion !== '1' && signatureVersion !== '2') {
    throw new Error('Unsupported SNS signature version');
  }

  const stringToSign = buildStringToSign(
    Object.fromEntries(
      Object.entries(envelope).map(([key, value]) => [key, String(value ?? '')]),
    ),
    type,
  );

  const pem = await fetchSigningCertificate(signingCertUrl);
  const algorithm = signatureVersion === '2' ? 'RSA-SHA256' : 'RSA-SHA1';
  const verifier = createVerify(algorithm);
  verifier.update(stringToSign, 'utf8');

  const valid = verifier.verify(pem, signature, 'base64');

  if (!valid) {
    throw new Error('Invalid SNS message signature');
  }

  const expectedTopicArn = process.env.SES_SNS_TOPIC_ARN?.trim();
  const topicArn = String(envelope.TopicArn ?? '');

  if (expectedTopicArn && topicArn && topicArn !== expectedTopicArn) {
    throw new Error('Unexpected SNS topic ARN');
  }
}
