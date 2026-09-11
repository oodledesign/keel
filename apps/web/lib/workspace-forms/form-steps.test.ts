import { describe, expect, it } from 'vitest';

import { defaultWorkspaceFormFields } from './form-fields';
import {
  buildPublicFormSteps,
  isWorkspaceFormFieldAnswered,
  shouldIncludeWelcomeStep,
  validatePublicFormStep,
} from './form-steps';

describe('shouldIncludeWelcomeStep', () => {
  it('is off for classic and embeds', () => {
    expect(
      shouldIncludeWelcomeStep({
        presentation: 'classic',
        layout: 'standard',
        hasIntro: true,
      }),
    ).toBe(false);

    expect(
      shouldIncludeWelcomeStep({
        presentation: 'steps',
        layout: 'standard',
        embed: true,
        hasIntro: true,
      }),
    ).toBe(false);
  });

  it('skips welcome when event layout already shows intro', () => {
    expect(
      shouldIncludeWelcomeStep({
        presentation: 'steps',
        layout: 'event',
        hasIntro: true,
      }),
    ).toBe(false);
  });

  it('includes welcome for standard steps with intro copy', () => {
    expect(
      shouldIncludeWelcomeStep({
        presentation: 'steps',
        layout: 'standard',
        hasIntro: true,
      }),
    ).toBe(true);

    expect(
      shouldIncludeWelcomeStep({
        presentation: 'steps',
        layout: 'standard',
        hasIntro: false,
      }),
    ).toBe(false);
  });
});

describe('buildPublicFormSteps', () => {
  it('uses visible field order and skips hidden fields', () => {
    const fields = [
      ...defaultWorkspaceFormFields(),
      {
        id: 'listing_id',
        type: 'hidden' as const,
        key: 'listing_id',
        label: 'Listing ID',
        required: false,
      },
    ];

    const steps = buildPublicFormSteps({ fields, includeWelcome: true });
    expect(steps[0]).toEqual({ kind: 'welcome' });
    expect(
      steps
        .filter((step) => step.kind === 'field')
        .map((step) => step.field.key),
    ).toEqual(['name', 'email', 'phone', 'message']);
  });
});

describe('isWorkspaceFormFieldAnswered', () => {
  const text = {
    id: 'name',
    type: 'name' as const,
    key: 'name',
    label: 'Name',
    required: true,
  };
  const checkbox = {
    id: 'opt_in',
    type: 'checkbox' as const,
    key: 'opt_in',
    label: 'Opt in',
    required: true,
  };

  it('treats trimmed text as answered', () => {
    expect(isWorkspaceFormFieldAnswered(text, 'Ada')).toBe(true);
    expect(isWorkspaceFormFieldAnswered(text, '  ')).toBe(false);
    expect(isWorkspaceFormFieldAnswered(text, undefined)).toBe(false);
  });

  it('requires checkbox true', () => {
    expect(isWorkspaceFormFieldAnswered(checkbox, true)).toBe(true);
    expect(isWorkspaceFormFieldAnswered(checkbox, false)).toBe(false);
  });

  it('treats file and hidden as answered', () => {
    expect(
      isWorkspaceFormFieldAnswered(
        {
          id: 'file',
          type: 'file',
          key: 'file',
          label: 'File',
          required: true,
        },
        undefined,
      ),
    ).toBe(true);
  });
});

describe('validatePublicFormStep', () => {
  it('allows welcome and optional empty fields', () => {
    expect(validatePublicFormStep({ kind: 'welcome' }, {})).toBeNull();
    expect(
      validatePublicFormStep(
        {
          kind: 'field',
          field: {
            id: 'phone',
            type: 'phone',
            key: 'phone',
            label: 'Phone',
            required: false,
          },
        },
        {},
      ),
    ).toBeNull();
  });

  it('blocks required empty fields', () => {
    expect(
      validatePublicFormStep(
        {
          kind: 'field',
          field: {
            id: 'email',
            type: 'email',
            key: 'email',
            label: 'Email',
            required: true,
          },
        },
        {},
      ),
    ).toBe('Please answer this question.');
  });
});
