import { describe, expect, it } from 'vitest';

import { defaultWorkspaceFormFields } from './form-fields';
import {
  matchFormLogicCondition,
  resolveStepJumpTarget,
  visibleFieldsForValues,
} from './form-logic';
import { buildPublicFormSteps } from './form-steps';

describe('form logic', () => {
  const [name, email, phone, message] = defaultWorkspaceFormFields();
  if (!name || !email || !phone || !message) {
    throw new Error('expected default fields');
  }

  const guests = {
    id: 'guests',
    type: 'text' as const,
    key: 'guests',
    label: 'Guests',
    required: true,
    visibleWhen: {
      fieldKey: 'attendance',
      op: 'equals' as const,
      value: 'Yes',
    },
  };
  const attendance = {
    id: 'attendance',
    type: 'yes_no' as const,
    key: 'attendance',
    label: 'Will you attend?',
    required: true,
    options: ['Yes', 'No'],
    jumpRules: [
      {
        id: 'skip_no',
        op: 'equals' as const,
        value: 'No',
        targetKey: '_submit',
      },
    ],
  };

  it('matches equals, contains, and is_answered', () => {
    expect(matchFormLogicCondition('Yes', 'equals', 'yes')).toBe(true);
    expect(matchFormLogicCondition('Office space', 'contains', 'office')).toBe(
      true,
    );
    expect(matchFormLogicCondition('', 'is_answered')).toBe(false);
    expect(matchFormLogicCondition(true, 'equals', 'yes')).toBe(true);
    expect(matchFormLogicCondition(false, 'not_equals', 'yes')).toBe(true);
  });

  it('hides later fields until the condition matches', () => {
    const fields = [name, attendance, guests, email];
    expect(
      visibleFieldsForValues(fields, { attendance: 'No' }).map(
        (field) => field.key,
      ),
    ).toEqual(['name', 'attendance', 'email']);
    expect(
      visibleFieldsForValues(fields, { attendance: 'Yes' }).map(
        (field) => field.key,
      ),
    ).toEqual(['name', 'attendance', 'guests', 'email']);
  });

  it('ignores forward-looking visibleWhen rules to avoid cycles', () => {
    const looped = {
      ...name,
      visibleWhen: { fieldKey: 'email', op: 'is_answered' as const },
    };
    expect(
      visibleFieldsForValues([looped, email], { email: 'ada@example.com' }).map(
        (field) => field.key,
      ),
    ).toEqual(['email']);
  });

  it('rebuilds steps from currently visible fields', () => {
    const fields = [
      { ...attendance, stepBreakAfter: true },
      { ...guests, stepBreakAfter: true },
      email,
    ];
    expect(
      buildPublicFormSteps({
        fields,
        values: { attendance: 'No' },
      })
        .filter((step) => step.kind === 'fields')
        .map((step) => step.fields.map((field) => field.key)),
    ).toEqual([['attendance'], ['email']]);
  });

  it('resolves a submit jump from the current step', () => {
    expect(
      resolveStepJumpTarget({
        stepFields: [attendance],
        values: { attendance: 'No' },
      }),
    ).toBe('_submit');
    expect(
      resolveStepJumpTarget({
        stepFields: [attendance],
        values: { attendance: 'Yes' },
      }),
    ).toBeNull();
  });
});
