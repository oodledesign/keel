import { describe, expect, it } from 'vitest';

import { defaultWorkspaceFormFields } from './form-fields';
import {
  buildPublicFormSteps,
  fieldHasStepBreakAfter,
  groupVisibleFieldsIntoSteps,
  isWorkspaceFormFieldAnswered,
  setFieldStepBreakAfter,
  shouldIncludeWelcomeStep,
  validatePublicFormStep,
  visibleFieldStepNumberById,
} from './form-steps';

const hiddenListing = {
  id: 'listing_id',
  type: 'hidden' as const,
  key: 'listing_id',
  label: 'Listing ID',
  required: false,
};

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

describe('groupVisibleFieldsIntoSteps', () => {
  it('defaults to one visible field per step and skips hidden fields', () => {
    const fields = [...defaultWorkspaceFormFields(), hiddenListing];
    expect(
      groupVisibleFieldsIntoSteps(fields).map((group) =>
        group.map((field) => field.key),
      ),
    ).toEqual([['name'], ['email'], ['phone'], ['message']]);
  });

  it('keeps following questions on the same step when stepBreakAfter is false', () => {
    const [name, email, phone, message] = defaultWorkspaceFormFields();
    if (!name || !email || !phone || !message) {
      throw new Error('expected default fields');
    }

    expect(
      groupVisibleFieldsIntoSteps([
        { ...name, stepBreakAfter: false },
        { ...email, stepBreakAfter: false },
        phone,
        message,
      ]).map((group) => group.map((field) => field.key)),
    ).toEqual([['name', 'email', 'phone'], ['message']]);
  });

  it('treats omitted stepBreakAfter as a break', () => {
    const [name] = defaultWorkspaceFormFields();
    if (!name) throw new Error('expected name');
    expect(fieldHasStepBreakAfter(name)).toBe(true);
    expect(fieldHasStepBreakAfter({ ...name, stepBreakAfter: false })).toBe(
      false,
    );
  });
});

describe('visibleFieldStepNumberById', () => {
  it('assigns the same step number to merged questions', () => {
    const fields = setFieldStepBreakAfter(
      defaultWorkspaceFormFields(),
      'name',
      false,
    );
    const numbers = visibleFieldStepNumberById(fields);
    expect(numbers.get('name')).toBe(1);
    expect(numbers.get('email')).toBe(1);
    expect(numbers.get('phone')).toBe(2);
    expect(numbers.get('message')).toBe(3);
  });
});

describe('buildPublicFormSteps', () => {
  it('uses visible field groups and an optional welcome step', () => {
    const fields = setFieldStepBreakAfter(
      [...defaultWorkspaceFormFields(), hiddenListing],
      'name',
      false,
    );

    const steps = buildPublicFormSteps({ fields, includeWelcome: true });
    expect(steps[0]).toEqual({ kind: 'welcome' });
    expect(
      steps
        .filter((step) => step.kind === 'fields')
        .map((step) => step.fields.map((field) => field.key)),
    ).toEqual([['name', 'email'], ['phone'], ['message']]);
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

  it('treats hidden as answered and files only when a file ref exists', () => {
    const fileField = {
      id: 'file',
      type: 'file' as const,
      key: 'file',
      label: 'File',
      required: true,
    };
    expect(
      isWorkspaceFormFieldAnswered(
        {
          id: 'hidden',
          type: 'hidden',
          key: 'listing_id',
          label: 'Listing',
          required: false,
        },
        undefined,
      ),
    ).toBe(true);
    expect(isWorkspaceFormFieldAnswered(fileField, undefined)).toBe(false);
    expect(
      isWorkspaceFormFieldAnswered(fileField, {
        name: 'brief.pdf',
        url: 'https://proj.supabase.co/storage/v1/object/public/workspace-form-uploads/acct/form/brief.pdf',
        path: 'acct/form/brief.pdf',
        mimeType: 'application/pdf',
        size: 1200,
      }),
    ).toBe(true);
  });
});

describe('validatePublicFormStep', () => {
  it('allows welcome and optional empty fields', () => {
    expect(validatePublicFormStep({ kind: 'welcome' }, {})).toBeNull();
    expect(
      validatePublicFormStep(
        {
          kind: 'fields',
          fields: [
            {
              id: 'phone',
              type: 'phone',
              key: 'phone',
              label: 'Phone',
              required: false,
            },
          ],
        },
        {},
      ),
    ).toBeNull();
  });

  it('blocks required empty fields on a single-question step', () => {
    expect(
      validatePublicFormStep(
        {
          kind: 'fields',
          fields: [
            {
              id: 'email',
              type: 'email',
              key: 'email',
              label: 'Email',
              required: true,
            },
          ],
        },
        {},
      ),
    ).toBe('Please answer this question.');
  });

  it('names the empty required field on a multi-question step', () => {
    expect(
      validatePublicFormStep(
        {
          kind: 'fields',
          fields: [
            {
              id: 'name',
              type: 'name',
              key: 'name',
              label: 'Name',
              required: true,
            },
            {
              id: 'email',
              type: 'email',
              key: 'email',
              label: 'Email',
              required: true,
            },
          ],
        },
        { name: 'Ada' },
      ),
    ).toBe('Please answer Email.');
  });
});
