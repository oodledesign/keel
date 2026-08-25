import type { IgMatchType, IgScope, IgTriggerRow } from './types';

const MAX_REGEX_PATTERN_LENGTH = 200;

/** Reject common catastrophic-backtracking patterns before persisting or matching. */
export function assertSafeTriggerRegex(pattern: string): void {
  const k = pattern.trim();
  if (!k) {
    throw new Error('Regex pattern cannot be empty');
  }
  if (k.length > MAX_REGEX_PATTERN_LENGTH) {
    throw new Error(
      `Regex pattern must be at most ${MAX_REGEX_PATTERN_LENGTH} characters`,
    );
  }
  if (/\([^)]*[+*][^)]*\)[+*?{]/.test(k)) {
    throw new Error('Unsafe regex pattern (nested quantifiers)');
  }
  try {
    new RegExp(k, 'i');
  } catch {
    throw new Error('Invalid regex pattern');
  }
}

export function matchTriggerKeyword(
  commentText: string,
  keywords: string[],
  matchType: IgMatchType,
): boolean {
  const text = commentText.trim();
  if (!text || keywords.length === 0) return false;

  const normalized = text.toLowerCase();

  for (const keyword of keywords) {
    const k = keyword.trim();
    if (!k) continue;

    if (matchType === 'exact') {
      if (normalized === k.toLowerCase()) return true;
      continue;
    }

    if (matchType === 'regex') {
      try {
        assertSafeTriggerRegex(k);
        if (new RegExp(k, 'i').test(text.slice(0, 2000))) return true;
      } catch {
        continue;
      }
      continue;
    }

    if (normalized.includes(k.toLowerCase())) return true;
  }

  return false;
}

export function triggerMatchesComment(
  trigger: Pick<
    IgTriggerRow,
    'keywords' | 'match_type' | 'scope' | 'target_media_ids' | 'is_active'
  >,
  commentText: string,
  mediaId: string | null,
): boolean {
  if (!trigger.is_active) return false;

  if (trigger.scope === 'specific_posts' && trigger.target_media_ids?.length) {
    if (!mediaId || !trigger.target_media_ids.includes(mediaId)) {
      return false;
    }
  }

  return matchTriggerKeyword(
    commentText,
    trigger.keywords,
    trigger.match_type as IgMatchType,
  );
}

export function findMatchingTrigger(
  triggers: IgTriggerRow[],
  commentText: string,
  mediaId: string | null,
): IgTriggerRow | null {
  for (const trigger of triggers) {
    if (triggerMatchesComment(trigger, commentText, mediaId)) {
      return trigger;
    }
  }
  return null;
}
