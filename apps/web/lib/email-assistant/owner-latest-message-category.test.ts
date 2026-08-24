import { describe, expect, it } from 'vitest';

import {
  categoryForOwnerLatestMessage,
  isAutoReplyMessage,
} from './owner-latest-message-category';

describe('isAutoReplyMessage', () => {
  it('detects Gmail vacation responder subjects', () => {
    expect(
      isAutoReplyMessage({
        subject: 'Out of Office — Off Re: CW Form Submission: Email Form',
        snippet:
          "Thanks for your message, I'm currently away so will get back to you when I'm back at work early next week.",
      }),
    ).toBe(true);
  });

  it('detects generic automatic replies', () => {
    expect(
      isAutoReplyMessage({
        subject: 'Automatic reply: Re: Invoice',
        snippet: 'I am away from the office until Monday.',
      }),
    ).toBe(true);
  });

  it('does not treat normal owner replies as auto-replies', () => {
    expect(
      isAutoReplyMessage({
        subject: 'Re: Project timeline',
        snippet: 'Thanks Louise — files look good, no changes needed.',
      }),
    ).toBe(false);
  });
});

describe('categoryForOwnerLatestMessage', () => {
  it('classifies OOO as noise', () => {
    expect(
      categoryForOwnerLatestMessage({
        subject: 'Out of Office — Off Re: Support ticket',
      }).category,
    ).toBe('noise');
  });

  it('classifies normal owner replies as waiting', () => {
    expect(
      categoryForOwnerLatestMessage({
        subject: 'Re: CRM',
        snippet: 'Will send this over tomorrow.',
      }),
    ).toEqual({
      category: 'waiting',
      reason: 'Latest message is from you',
      confidence: 1,
    });
  });
});
