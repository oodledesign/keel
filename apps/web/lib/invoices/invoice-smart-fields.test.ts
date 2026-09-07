import { describe, expect, it } from 'vitest';

import {
  DEFAULT_INVOICE_EMAIL_SUBJECT,
  INVOICE_SMART_FIELD_PILLS,
  LEGACY_INVOICE_EMAIL_SUBJECT,
  formatWorkspaceSenderName,
  renderSmartFields,
} from '~/home/[account]/invoices/_lib/invoice-smart-fields';

describe('formatWorkspaceSenderName', () => {
  it('attributes the workspace to the platform domain', () => {
    expect(formatWorkspaceSenderName('Oodle Design', 'Ozer')).toBe(
      'Oodle Design via Ozer',
    );
  });

  it('does not double the product name', () => {
    expect(formatWorkspaceSenderName('Ozer', 'Ozer')).toBe('Ozer');
  });

  it('falls back to the product name', () => {
    expect(formatWorkspaceSenderName('  ', 'Ozer')).toBe('Ozer');
    expect(formatWorkspaceSenderName(null, 'Ozer')).toBe('Ozer');
  });
});

describe('DEFAULT_INVOICE_EMAIL_SUBJECT', () => {
  it('drops the payment-bait legacy subject', () => {
    expect(DEFAULT_INVOICE_EMAIL_SUBJECT).not.toBe(
      LEGACY_INVOICE_EMAIL_SUBJECT,
    );
  });

  it('renders invoice number and workspace instead of payment bait', () => {
    expect(
      renderSmartFields(DEFAULT_INVOICE_EMAIL_SUBJECT, {
        invoice: { invoice_number: 'INV-0455' },
        accountName: 'Oodle Design',
      }),
    ).toBe('Invoice INV-0455 from Oodle Design');
  });

  it('leaves a gap when workspace name is missing from preview context', () => {
    expect(
      renderSmartFields(DEFAULT_INVOICE_EMAIL_SUBJECT, {
        invoice: { invoice_number: 'INV-0456' },
      }),
    ).toBe('Invoice INV-0456 from ');
  });
});

describe('invoice project name merge field', () => {
  it('exposes Project name in the insertable pills', () => {
    expect(
      INVOICE_SMART_FIELD_PILLS.some(
        (field) =>
          field.token === '{{project.name}}' && field.label === 'Project name',
      ),
    ).toBe(true);
  });

  it('renders the linked project name', () => {
    expect(
      renderSmartFields('Invoice for {{project.name}}', {
        projectName: 'Website refresh',
      }),
    ).toBe('Invoice for Website refresh');
  });

  it('resolves the snake_case alias', () => {
    expect(
      renderSmartFields('Project: {{project_name}}', {
        projectName: 'Brand refresh',
      }),
    ).toBe('Project: Brand refresh');
  });

  it('resolves to empty when the invoice is not linked to a project', () => {
    expect(
      renderSmartFields('Invoice for {{project.name}}.', {
        projectName: null,
      }),
    ).toBe('Invoice for .');
    expect(renderSmartFields('{{project.name}}{{project_name}}', {})).toBe('');
  });
});
