import { describe, expect, it } from 'vitest';

import {
  automationMatchesNewSubscriberScope,
  describeWelcomeAutomationScope,
  isUnscopedWelcomeAutomation,
} from './campaign-automation-scope';

const FORM_A = '11111111-1111-4111-8111-111111111111';
const FORM_B = '22222222-2222-4222-8222-222222222222';
const LIST_A = '33333333-3333-4333-8333-333333333333';
const LIST_B = '44444444-4444-4444-8444-444444444444';

describe('welcome automation scope', () => {
  it('treats both-null as workspace-wide', () => {
    expect(
      isUnscopedWelcomeAutomation({ formId: null, audienceListId: null }),
    ).toBe(true);
    expect(
      isUnscopedWelcomeAutomation({ formId: FORM_A, audienceListId: null }),
    ).toBe(false);
  });

  it('includes global automations unless includeUnscoped is false', () => {
    const global = { formId: null, audienceListId: null };
    expect(automationMatchesNewSubscriberScope(global, {})).toBe(true);
    expect(
      automationMatchesNewSubscriberScope(global, {
        formId: FORM_A,
        includeUnscoped: true,
      }),
    ).toBe(true);
    expect(
      automationMatchesNewSubscriberScope(global, {
        formId: FORM_A,
        includeUnscoped: false,
      }),
    ).toBe(false);
  });

  it('matches a form-scoped automation only for that form', () => {
    const scoped = { formId: FORM_A, audienceListId: null };
    expect(
      automationMatchesNewSubscriberScope(scoped, { formId: FORM_A }),
    ).toBe(true);
    expect(
      automationMatchesNewSubscriberScope(scoped, { formId: FORM_B }),
    ).toBe(false);
    expect(automationMatchesNewSubscriberScope(scoped, {})).toBe(false);
  });

  it('matches a list-scoped automation only for that list', () => {
    const scoped = { formId: null, audienceListId: LIST_A };
    expect(
      automationMatchesNewSubscriberScope(scoped, { audienceListId: LIST_A }),
    ).toBe(true);
    expect(
      automationMatchesNewSubscriberScope(scoped, { audienceListId: LIST_B }),
    ).toBe(false);
    expect(
      automationMatchesNewSubscriberScope(scoped, { formId: FORM_A }),
    ).toBe(false);
  });

  it('uses OR when an automation has both form and list', () => {
    const scoped = { formId: FORM_A, audienceListId: LIST_A };
    expect(
      automationMatchesNewSubscriberScope(scoped, { formId: FORM_A }),
    ).toBe(true);
    expect(
      automationMatchesNewSubscriberScope(scoped, { audienceListId: LIST_A }),
    ).toBe(true);
    expect(
      automationMatchesNewSubscriberScope(scoped, {
        formId: FORM_B,
        audienceListId: LIST_B,
      }),
    ).toBe(false);
  });

  it('describes workspace vs form/list scope', () => {
    expect(
      describeWelcomeAutomationScope({ formId: null, audienceListId: null }),
    ).toBe('Any mailing list (workspace)');
    expect(
      describeWelcomeAutomationScope({
        formId: FORM_A,
        audienceListId: LIST_A,
        formName: 'Events',
        listName: 'VIP',
      }),
    ).toBe('Form: Events · List: VIP');
  });
});
