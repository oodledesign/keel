import { describe, expect, it } from 'vitest';

import {
  WORKSPACE_FORM_TEMPLATES,
  listWorkspaceFormTemplates,
  workspaceFormCreateDefaultsForTemplate,
  workspaceFormFieldsForTemplate,
} from './form-templates';

describe('workspace form templates', () => {
  it('exposes contact, blank, and rsvp templates', () => {
    expect(WORKSPACE_FORM_TEMPLATES).toEqual(['contact', 'blank', 'rsvp']);
    expect(listWorkspaceFormTemplates().map((meta) => meta.id)).toEqual([
      'contact',
      'blank',
      'rsvp',
    ]);
  });

  it('maps contact to the current default fields', () => {
    expect(workspaceFormFieldsForTemplate('contact').map((f) => f.key)).toEqual(
      ['name', 'email', 'phone', 'message'],
    );
  });

  it('maps blank to name and email only', () => {
    expect(workspaceFormFieldsForTemplate('blank').map((f) => f.key)).toEqual([
      'name',
      'email',
    ]);
  });

  it('maps RSVP field keys and types', () => {
    const fields = workspaceFormFieldsForTemplate('rsvp');
    expect(
      fields.map((field) => ({
        key: field.key,
        type: field.type,
        required: field.required,
        label: field.label,
      })),
    ).toEqual([
      { key: 'name', type: 'name', required: true, label: 'Name' },
      { key: 'email', type: 'email', required: true, label: 'Email' },
      {
        key: 'attendance',
        type: 'select',
        required: true,
        label: 'Will you attend?',
      },
      {
        key: 'guests',
        type: 'text',
        required: false,
        label: 'Number of guests',
      },
      {
        key: 'dietary',
        type: 'textarea',
        required: false,
        label: 'Dietary requirements',
      },
      { key: 'message', type: 'message', required: false, label: 'Comments' },
    ]);

    const attendance = fields.find((field) => field.key === 'attendance');
    expect(attendance?.options).toEqual(['Yes', 'No', 'Maybe']);
  });

  it('provides create defaults for RSVP', () => {
    const defaults = workspaceFormCreateDefaultsForTemplate('rsvp');
    expect(defaults.defaultName).toBe('Event RSVP');
    expect(defaults.suggestedDestination).toBe('pipeline');
    expect(defaults.submitLabel).toBe('Send RSVP');
    expect(defaults.successMessage).toMatch(/RSVP/i);
    expect(defaults.fields.map((field) => field.key)).toContain('attendance');
  });
});
