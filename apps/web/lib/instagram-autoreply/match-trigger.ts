import type { IgMatchType, IgTriggerFullRow, IgTriggerRow } from './types';

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

/** Inbound events that can start an automation (v2 trigger types). */
export type IgInboundTriggerEvent =
  | {
      kind: 'comment';
      text: string;
      mediaId: string | null;
      mediaProductType: string | null;
    }
  | { kind: 'dm'; text: string; isFirstMessage: boolean }
  | { kind: 'story_reply'; text: string; storyId: string | null }
  | { kind: 'story_mention' };

type V2MatchFields = Pick<
  IgTriggerFullRow,
  | 'is_active'
  | 'keywords'
  | 'match_type'
  | 'target_media_ids'
  | 'trigger_type'
  | 'match_mode'
  | 'media_scope'
  | 'media_id'
>;

function keywordsMatch(trigger: V2MatchFields, text: string): boolean {
  if (trigger.match_mode === 'any') return true;
  const mode: IgMatchType =
    trigger.match_type === 'regex' ? 'regex' : trigger.match_mode;
  return matchTriggerKeyword(text, trigger.keywords, mode);
}

function mediaMatches(trigger: V2MatchFields, mediaId: string | null) {
  if (!mediaId) return false;
  return (
    trigger.media_id === mediaId ||
    Boolean(trigger.target_media_ids?.includes(mediaId))
  );
}

export function v2TriggerMatches(
  trigger: V2MatchFields,
  event: IgInboundTriggerEvent,
): boolean {
  if (!trigger.is_active) return false;

  switch (trigger.trigger_type) {
    case 'comment_keyword': {
      if (event.kind !== 'comment') return false;
      if (trigger.media_scope === 'specific_post') {
        if (!mediaMatches(trigger, event.mediaId)) return false;
      } else if (trigger.media_scope === 'reels') {
        if (event.mediaProductType?.toUpperCase() !== 'REELS') return false;
      }
      return keywordsMatch(trigger, event.text);
    }
    case 'dm_keyword':
      return event.kind === 'dm' && keywordsMatch(trigger, event.text);
    case 'first_message':
      return event.kind === 'dm' && event.isFirstMessage;
    case 'story_reply': {
      if (event.kind !== 'story_reply') return false;
      if (
        trigger.media_scope === 'specific_post' &&
        !mediaMatches(trigger, event.storyId)
      ) {
        return false;
      }
      return (
        trigger.keywords.length === 0 || keywordsMatch(trigger, event.text)
      );
    }
    case 'story_mention':
      return event.kind === 'story_mention';
    default:
      return false;
  }
}

const DM_TRIGGER_PRIORITY: Record<string, number> = {
  dm_keyword: 0,
  story_reply: 0,
  story_mention: 0,
  comment_keyword: 0,
  first_message: 1,
};

/**
 * All matching triggers, most specific first (a keyword trigger wins over the
 * first-message welcome when both match).
 */
export function findMatchingV2Triggers<T extends V2MatchFields>(
  triggers: T[],
  event: IgInboundTriggerEvent,
): T[] {
  return triggers
    .filter((trigger) => v2TriggerMatches(trigger, event))
    .sort(
      (a, b) =>
        (DM_TRIGGER_PRIORITY[a.trigger_type] ?? 0) -
        (DM_TRIGGER_PRIORITY[b.trigger_type] ?? 0),
    );
}
