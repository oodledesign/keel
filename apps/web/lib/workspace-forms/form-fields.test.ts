import { describe, expect, it } from 'vitest';

import {
  createWorkspaceFormField,
  defaultWorkspaceFormFields,
  ensureListingField,
  extractContactFromValues,
  formatPipelineNotes,
  resolveBoundListingId,
} from './form-fields';

describe('workspace form fields', () => {
  it('defaults to name, email, phone, and message', () => {
    expect(defaultWorkspaceFormFields().map((field) => field.key)).toEqual([
      'name',
      'email',
      'phone',
      'message',
    ]);
  });

  it('adds a hidden listing field once', () => {
    const withListing = ensureListingField(defaultWorkspaceFormFields());
    expect(withListing.some((field) => field.key === 'listing_id')).toBe(true);
    expect(ensureListingField(withListing)).toHaveLength(withListing.length);
  });

  it('extracts contact values and extras from a submission', () => {
    const fields = [
      ...defaultWorkspaceFormFields(),
      createWorkspaceFormField('select', defaultWorkspaceFormFields()),
    ];
    const select = fields.at(-1);
    if (!select) throw new Error('expected select field');
    select.key = 'sector';
    select.options = ['Office', 'Retail'];

    const contact = extractContactFromValues(fields, {
      name: 'Jane Doe',
      email: 'jane@example.com',
      phone: '07700 900123',
      message: 'Looking at Unit 3',
      sector: 'Office',
    });

    expect(contact.contactName).toBe('Jane Doe');
    expect(contact.contactEmail).toBe('jane@example.com');
    expect(contact.contactPhone).toBe('07700 900123');
    expect(contact.message).toBe('Looking at Unit 3');
    expect(contact.extras.sector).toBe('Office');
  });

  it('prefers query listing id over hidden and form defaults', () => {
    expect(
      resolveBoundListingId({
        queryListingId: '11111111-1111-4111-8111-111111111111',
        hiddenListingId: '22222222-2222-4222-8222-222222222222',
        formListingId: '33333333-3333-4333-8333-333333333333',
      }),
    ).toBe('11111111-1111-4111-8111-111111111111');

    expect(
      resolveBoundListingId({
        queryListingId: 'not-a-uuid',
        hiddenListingId: '22222222-2222-4222-8222-222222222222',
        formListingId: null,
      }),
    ).toBe('22222222-2222-4222-8222-222222222222');
  });

  it('formats pipeline notes with contact details and extras', () => {
    expect(
      formatPipelineNotes({
        contactEmail: 'jane@example.com',
        contactPhone: '07700 900123',
        message: 'Please call tomorrow',
        extras: { sector: 'Office' },
      }),
    ).toBe(
      [
        'Email: jane@example.com',
        'Phone: 07700 900123',
        'Please call tomorrow',
        '',
        'sector: Office',
      ].join('\n'),
    );
  });
});
