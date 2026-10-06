import 'server-only';

import type { ClassifyResult } from '@kit/email-assistant';

import { askTypeSafe, isTypeSafeConfigured } from '~/lib/ai/typesafe';

import {
  type EmailThreadCategory,
  isEmailThreadCategory,
} from './email-thread-categories';

/** Below this Jev confidence the caller should fall back to the generative model. */
export const JEV_MIN_CONFIDENCE = 0.55;

/** Jev loses accuracy on large state; the newest messages matter most. */
const MAX_STATE_CHARS = 6_000;

export function isJevTriageEnabled(): boolean {
  return isTypeSafeConfigured();
}

/**
 * Classify a thread with Jev (one Choice question). Returns null when Jev is
 * unavailable, errors, or is not confident enough, so the caller can fall back
 * to the generative classifier.
 */
export async function classifyThreadWithJev(input: {
  threadText: string;
  ownerEmail: string;
  ownerDisplayName: string | null;
}): Promise<ClassifyResult | null> {
  if (!isJevTriageEnabled()) {
    return null;
  }

  const threadText = input.threadText.trim();

  if (!threadText) {
    return { category: 'noise', reason: 'Empty thread', confidence: 1 };
  }

  const trimmed =
    threadText.length > MAX_STATE_CHARS
      ? threadText.slice(-MAX_STATE_CHARS)
      : threadText;

  try {
    const { answers } = await askTypeSafe({
      state: {
        mailbox_owner: {
          name: input.ownerDisplayName,
          email: input.ownerEmail,
        },
        email_thread: trimmed,
      },
      questions: {
        category: {
          type: 'choice',
          instructions: {
            question:
              'How should `mailbox_owner` treat `email_thread`? Judge the latest message in the thread.',
          },
          criteria: {
            reply_later:
              'A real person wants a personal reply from the mailbox owner, but it is not urgent',
            reply_now:
              'A real person is waiting on the mailbox owner right now: a direct ask, urgent decision or scheduling request',
            waiting:
              'The mailbox owner sent the latest message, or the thread is waiting on the other party to respond',
            fyi: 'A human update, thanks or acknowledgement that does not need a reply',
            noise:
              'Newsletters, marketing, automated receipts or alerts, mailing lists, no-reply senders',
          },
        },
      },
    });

    const answer = answers.category;

    if (
      !answer ||
      answer.type !== 'choice' ||
      !isEmailThreadCategory(answer.choice) ||
      answer.confidence < JEV_MIN_CONFIDENCE
    ) {
      return null;
    }

    return {
      category: answer.choice as EmailThreadCategory,
      reason: null,
      confidence: answer.confidence,
    };
  } catch (error) {
    console.error(
      '[jev-classify] falling back to generative classifier',
      error instanceof Error ? error.message : String(error),
    );

    return null;
  }
}
