import type {
  ParsedSesEvent,
  WorkspaceEmailEventType,
} from './ses-event-types';

const SES_EVENT_TYPE_MAP: Record<string, WorkspaceEmailEventType> = {
  Send: 'send',
  Delivery: 'delivery',
  Bounce: 'bounce',
  Complaint: 'complaint',
  Open: 'open',
  Click: 'click',
  Reject: 'reject',
  RenderingFailure: 'rendering_failure',
  DeliveryDelay: 'delivery_delay',
};

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return null;
  }
  return value as Record<string, unknown>;
}

function asString(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => (typeof item === 'string' ? item.trim().toLowerCase() : ''))
    .filter(Boolean);
}

function pickTimestamp(
  ...candidates: Array<string | null | undefined>
): string {
  for (const candidate of candidates) {
    if (!candidate) continue;
    const date = new Date(candidate);
    if (!Number.isNaN(date.getTime())) {
      return date.toISOString();
    }
  }
  return new Date().toISOString();
}

/**
 * Parse an SES event JSON object (the Message body of an SNS Notification,
 * or a direct SES Event Publishing payload).
 */
export function parseSesEventPayload(payload: unknown): ParsedSesEvent | null {
  const root = asRecord(payload);
  if (!root) return null;

  const eventTypeRaw = asString(root.eventType);
  const eventType = eventTypeRaw ? SES_EVENT_TYPE_MAP[eventTypeRaw] : undefined;
  if (!eventType) return null;

  const mail = asRecord(root.mail) ?? {};
  const sesMessageId = asString(mail.messageId) ?? asString(root.mailMessageId);
  if (!sesMessageId) return null;

  const bounce = asRecord(root.bounce);
  const complaint = asRecord(root.complaint);
  const click = asRecord(root.click);
  const open = asRecord(root.open);
  const delivery = asRecord(root.delivery);
  const reject = asRecord(root.reject);
  const failure = asRecord(root.failure);
  const deliveryDelay = asRecord(root.deliveryDelay);

  const destinationEmails = Array.from(
    new Set([
      ...asStringArray(mail.destination),
      ...asStringArray(delivery?.recipients),
      ...((bounce?.bouncedRecipients as unknown[]) ?? [])
        .map((row) => asRecord(row)?.emailAddress)
        .map((email) => asString(email)?.toLowerCase() ?? '')
        .filter(Boolean),
      ...((complaint?.complainedRecipients as unknown[]) ?? [])
        .map((row) => asRecord(row)?.emailAddress)
        .map((email) => asString(email)?.toLowerCase() ?? '')
        .filter(Boolean),
    ]),
  );

  return {
    eventType,
    sesMessageId,
    eventAt: pickTimestamp(
      asString(root.timestamp) ?? undefined,
      asString(delivery?.timestamp) ?? undefined,
      asString(bounce?.timestamp) ?? undefined,
      asString(complaint?.timestamp) ?? undefined,
      asString(open?.timestamp) ?? undefined,
      asString(click?.timestamp) ?? undefined,
      asString(deliveryDelay?.timestamp) ?? undefined,
      asString(mail.timestamp) ?? undefined,
    ),
    linkUrl: asString(click?.link),
    bounceType: asString(bounce?.bounceType),
    bounceSubtype: asString(bounce?.bounceSubType),
    complaintFeedbackType: asString(complaint?.complaintFeedbackType),
    destinationEmails,
    raw: {
      eventType: eventTypeRaw,
      mail,
      bounce: bounce ?? undefined,
      complaint: complaint ?? undefined,
      open: open ?? undefined,
      click: click ?? undefined,
      delivery: delivery ?? undefined,
      reject: reject ?? undefined,
      failure: failure ?? undefined,
      deliveryDelay: deliveryDelay ?? undefined,
    },
  };
}

export function parseSnsEnvelope(body: unknown): {
  type: string;
  messageId: string | null;
  message: string | null;
  subscribeUrl: string | null;
  topicArn: string | null;
  raw: Record<string, unknown>;
} | null {
  const root = asRecord(body);
  if (!root) return null;

  return {
    type: asString(root.Type) ?? '',
    messageId: asString(root.MessageId),
    message: typeof root.Message === 'string' ? root.Message : null,
    subscribeUrl: asString(root.SubscribeURL),
    topicArn: asString(root.TopicArn),
    raw: root,
  };
}
