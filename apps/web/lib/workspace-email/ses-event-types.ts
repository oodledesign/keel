export const WORKSPACE_EMAIL_EVENT_TYPES = [
  'send',
  'delivery',
  'bounce',
  'complaint',
  'open',
  'click',
  'reject',
  'rendering_failure',
  'delivery_delay',
] as const;

export type WorkspaceEmailEventType =
  (typeof WORKSPACE_EMAIL_EVENT_TYPES)[number];

export type ParsedSesEvent = {
  eventType: WorkspaceEmailEventType;
  sesMessageId: string;
  eventAt: string;
  linkUrl: string | null;
  bounceType: string | null;
  bounceSubtype: string | null;
  complaintFeedbackType: string | null;
  destinationEmails: string[];
  raw: Record<string, unknown>;
};

export type WorkspaceEmailEventSource = 'campaign' | 'circulation';

export type ApplySesEventResult =
  | { applied: false; reason: 'duplicate' | 'unmatched' | 'ignored' }
  | {
      applied: true;
      source: WorkspaceEmailEventSource;
      eventType: WorkspaceEmailEventType;
      recipientId: string;
    };
