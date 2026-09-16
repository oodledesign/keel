import { describe, expect, it } from 'vitest';

import type { WorkspaceFormField } from './form-fields';
import {
  audienceFormCreateError,
  canAccessWorkspaceForms,
  resolveWorkspaceFormsMode,
  sanitizeAudienceFormFields,
} from './forms-mode';

describe('resolveWorkspaceFormsMode', () => {
  it('treats an empty or missing map as full (unconfigured workspace)', () => {
    expect(resolveWorkspaceFormsMode(null)).toBe('full');
    expect(resolveWorkspaceFormsMode(undefined)).toBe('full');
    expect(resolveWorkspaceFormsMode({})).toBe('full');
  });

  it('grants full when the Forms module is on', () => {
    expect(resolveWorkspaceFormsMode({ forms: true, campaigns: false })).toBe(
      'full',
    );
    expect(resolveWorkspaceFormsMode({ forms: true, campaigns: true })).toBe(
      'full',
    );
  });

  it('grants audience when Campaigns is on and Forms is off', () => {
    expect(
      resolveWorkspaceFormsMode({
        campaigns: true,
        forms: false,
        dashboard: true,
      }),
    ).toBe('audience');
  });

  it('is none when neither module is on', () => {
    expect(
      resolveWorkspaceFormsMode({
        dashboard: true,
        forms: false,
        campaigns: false,
      }),
    ).toBe('none');
  });
});

describe('canAccessWorkspaceForms', () => {
  it('is true for full and audience', () => {
    expect(canAccessWorkspaceForms({ forms: true })).toBe(true);
    expect(canAccessWorkspaceForms({ campaigns: true, forms: false })).toBe(
      true,
    );
    expect(canAccessWorkspaceForms({ dashboard: true, forms: false })).toBe(
      false,
    );
  });
});

describe('audienceFormCreateError', () => {
  it('allows subscribe → mailing_list', () => {
    expect(
      audienceFormCreateError({
        destination: 'mailing_list',
        template: 'subscribe',
      }),
    ).toBeNull();
  });

  it('rejects other destinations and templates', () => {
    expect(
      audienceFormCreateError({
        destination: 'pipeline',
        template: 'subscribe',
      }),
    ).toMatch(/mailing-list/i);
    expect(
      audienceFormCreateError({
        destination: 'mailing_list',
        template: 'contact',
      }),
    ).toMatch(/mailing-list/i);
  });
});

describe('sanitizeAudienceFormFields', () => {
  it('strips logic and downgrades file fields', () => {
    const fields: WorkspaceFormField[] = [
      {
        id: 'email',
        type: 'email',
        key: 'email',
        label: 'Email',
        required: true,
        visibleWhen: { fieldKey: 'name', op: 'is_answered' },
        jumpRules: [
          {
            id: 'j1',
            op: 'equals',
            targetKey: '_submit',
          },
        ],
      },
      {
        id: 'cv',
        type: 'file',
        key: 'cv',
        label: 'CV',
        required: false,
      },
    ];

    expect(sanitizeAudienceFormFields(fields)).toEqual([
      {
        id: 'email',
        type: 'email',
        key: 'email',
        label: 'Email',
        required: true,
      },
      {
        id: 'cv',
        type: 'text',
        key: 'cv',
        label: 'CV',
        required: false,
      },
    ]);
  });
});
