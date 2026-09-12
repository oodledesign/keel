import { describe, expect, it } from 'vitest';

import { defaultWorkspaceFormFields } from './form-fields';
import {
  sanitizePublicFormValues,
  validateVisibleFormFields,
  validateWorkspaceFormField,
} from './form-validate';

describe('form validation', () => {
  const select = {
    id: 'sector',
    type: 'select' as const,
    key: 'sector',
    label: 'Sector',
    required: true,
    options: ['Office', 'Retail'],
  };
  const file = {
    id: 'brief',
    type: 'file' as const,
    key: 'brief',
    label: 'Brief',
    required: true,
  };
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
  };

  it('requires a chosen select option and a valid email', () => {
    expect(validateWorkspaceFormField(select, undefined)).toBe(
      'Please answer Sector.',
    );
    expect(validateWorkspaceFormField(select, 'Warehouse')).toBe(
      'Please choose one of the available options.',
    );
    expect(validateWorkspaceFormField(select, 'Office')).toBeNull();

    const email = defaultWorkspaceFormFields()[1];
    if (!email) throw new Error('expected email');
    expect(validateWorkspaceFormField(email, 'not-an-email')).toBe(
      'Please enter a valid email.',
    );
    expect(validateWorkspaceFormField(email, 'ada@example.com')).toBeNull();
  });

  it('requires a file ref for required file fields', () => {
    expect(validateWorkspaceFormField(file, undefined)).toBe(
      'Please answer Brief.',
    );
    expect(
      validateWorkspaceFormField(file, {
        name: 'brief.pdf',
        url: 'https://proj.supabase.co/storage/v1/object/public/workspace-form-uploads/acct/form/brief.pdf',
        path: 'acct/form/brief.pdf',
        mimeType: 'application/pdf',
        size: 800,
      }),
    ).toBeNull();
  });

  it('does not block submit on hidden required fields', () => {
    expect(
      validateVisibleFormFields([attendance, guests], { attendance: 'No' }),
    ).toBeNull();
    expect(
      validateVisibleFormFields([attendance, guests], { attendance: 'Yes' }),
    ).toBe('Please answer Guests.');
  });

  it('drops hidden answers and foreign file paths from the payload', () => {
    const values = sanitizePublicFormValues({
      fields: [attendance, guests, file],
      values: {
        attendance: 'No',
        guests: '2',
        brief: {
          name: 'brief.pdf',
          url: 'https://proj.supabase.co/storage/v1/object/public/workspace-form-uploads/other-account/other-form/brief.pdf',
          path: 'other-account/other-form/brief.pdf',
          mimeType: 'application/pdf',
          size: 800,
        },
      },
      accountId: '11111111-1111-4111-8111-111111111111',
      formId: '22222222-2222-4222-8222-222222222222',
    });
    expect(values).toEqual({ attendance: 'No' });
  });
});
