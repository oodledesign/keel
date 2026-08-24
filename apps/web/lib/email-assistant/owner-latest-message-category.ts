import type { EmailThreadCategory } from './email-thread-categories';

const AUTO_REPLY_PATTERNS = [
  /\bout of office\b/i,
  /\bautomatic reply\b/i,
  /\bauto-?reply\b/i,
  /\bautoreply\b/i,
  /\baway from (?:the )?(?:office|my desk|email)\b/i,
  /\bon (?:vacation|leave)\b/i,
  /\bcurrently away\b/i,
  /\bi['’]?m away\b/i,
  /\bi am away\b/i,
  /\bvacation responder\b/i,
  /\bwill get back to you when\b/i,
];

function autoReplyHaystack(input: {
  subject?: string | null;
  snippet?: string | null;
  bodyText?: string | null;
}): string {
  return [input.subject, input.snippet, input.bodyText]
    .filter((value): value is string => Boolean(value?.trim()))
    .join('\n');
}

export function isAutoReplyMessage(input: {
  subject?: string | null;
  snippet?: string | null;
  bodyText?: string | null;
}): boolean {
  const haystack = autoReplyHaystack(input);
  if (!haystack.trim()) {
    return false;
  }

  return AUTO_REPLY_PATTERNS.some((pattern) => pattern.test(haystack));
}

export function categoryForOwnerLatestMessage(input: {
  subject?: string | null;
  snippet?: string | null;
  bodyText?: string | null;
}): {
  category: EmailThreadCategory;
  reason: string;
  confidence: number;
} {
  if (isAutoReplyMessage(input)) {
    return {
      category: 'noise',
      reason: 'Automatic out-of-office reply',
      confidence: 1,
    };
  }

  return {
    category: 'waiting',
    reason: 'Latest message is from you',
    confidence: 1,
  };
}
