import { describe, expect, it, vi } from 'vitest';

import { categoryForGmailLabels } from './gmail-label-category';

vi.mock('server-only', () => ({}));

describe('categoryForGmailLabels', () => {
  it('treats spam and trash as noise', () => {
    expect(
      categoryForGmailLabels(['UNREAD', 'CATEGORY_PERSONAL', 'SPAM']),
    ).toEqual({ category: 'noise', reason: 'In Gmail spam' });
    expect(categoryForGmailLabels(['TRASH', 'CATEGORY_UPDATES'])).toEqual({
      category: 'noise',
      reason: 'In Gmail trash',
    });
  });

  it('treats a draft-only thread as noise', () => {
    expect(categoryForGmailLabels(['DRAFT'])).toEqual({
      category: 'noise',
      reason: 'Unsent draft',
    });
  });

  it('leaves inbox threads with a reply draft alone', () => {
    expect(categoryForGmailLabels(['INBOX', 'DRAFT'])).toBeNull();
    expect(categoryForGmailLabels(['SENT', 'DRAFT'])).toBeNull();
  });

  it('returns null for normal or missing labels', () => {
    expect(categoryForGmailLabels(['INBOX', 'UNREAD'])).toBeNull();
    expect(categoryForGmailLabels(null)).toBeNull();
    expect(categoryForGmailLabels([])).toBeNull();
  });
});

describe('matchEmailTriageRule owner handling', () => {
  it('never applies priority rules to the mailbox owner', async () => {
    const { emptyEmailTriageRules, matchEmailTriageRule } =
      await import('./email-triage-rules');
    const rules = {
      ...emptyEmailTriageRules(),
      prioritySenders: ['dan@oodle.design'],
      priorityDomains: ['oodle.design'],
      prioritySubjectKeywords: ['report'],
    };

    expect(
      matchEmailTriageRule(
        {
          fromAddress: 'Dan Potter <dan@oodle.design>',
          subject: 'Arcanum Report',
          ownerEmail: 'dan@oodle.design',
        },
        rules,
      ),
    ).toBeNull();

    expect(
      matchEmailTriageRule(
        {
          fromAddress: 'dan@oodle.design',
          subject: 'Arcanum Report',
          ownerEmail: 'someone@else.com',
        },
        rules,
      )?.action,
    ).toBe('priority');
  });

  it('still lets ignore rules match the owner', async () => {
    const { emptyEmailTriageRules, matchEmailTriageRule } =
      await import('./email-triage-rules');
    const rules = {
      ...emptyEmailTriageRules(),
      ignoredSubjectKeywords: ['newsletter'],
    };

    expect(
      matchEmailTriageRule(
        {
          fromAddress: 'dan@oodle.design',
          subject: 'Weekly newsletter',
          ownerEmail: 'dan@oodle.design',
        },
        rules,
      )?.action,
    ).toBe('ignore');
  });
});
