import { describe, expect, it } from 'vitest';

import {
  brandPageGradientCss,
  darkenHex,
  parseWorkspaceFormTheme,
  resolveWorkspaceFormLayout,
} from './form-theme';

describe('darkenHex', () => {
  it('darkens a 6-digit hex toward black', () => {
    expect(darkenHex('#0D2344', 0.16).toLowerCase()).toBe('#0b1d39');
  });

  it('expands 3-digit hex', () => {
    expect(darkenHex('#abc', 0).toLowerCase()).toBe('#aabbcc');
  });

  it('returns invalid input unchanged', () => {
    expect(darkenHex('navy', 0.2)).toBe('navy');
  });
});

describe('brandPageGradientCss', () => {
  it('builds a 135deg primary → darker gradient', () => {
    expect(brandPageGradientCss('#0D2344')).toBe(
      'linear-gradient(135deg, #0D2344, #0b1d39)',
    );
  });
});

describe('parseWorkspaceFormTheme', () => {
  it('defaults to light standard', () => {
    expect(parseWorkspaceFormTheme(null)).toEqual({
      pageBackground: 'light',
      layout: 'standard',
    });
  });

  it('reads brand_gradient and event layout', () => {
    expect(
      parseWorkspaceFormTheme({
        pageBackground: 'brand_gradient',
        layout: 'event',
      }),
    ).toEqual({ pageBackground: 'brand_gradient', layout: 'event' });
  });

  it('accepts pageLayout / formLayout / rsvp aliases', () => {
    expect(parseWorkspaceFormTheme({ pageLayout: 'event' }).layout).toBe(
      'event',
    );
    expect(parseWorkspaceFormTheme({ formLayout: 'rsvp' }).layout).toBe(
      'event',
    );
  });
});

describe('resolveWorkspaceFormLayout', () => {
  const attendanceField = {
    type: 'yes_no',
    key: 'attendance',
    label: 'Will you attend?',
  };

  it('keeps stored event layout', () => {
    expect(resolveWorkspaceFormLayout('event')).toBe('event');
  });

  it('forces event layout when event_address is set', () => {
    expect(
      resolveWorkspaceFormLayout('standard', {
        eventAddress: 'The Clubhouse, London',
      }),
    ).toBe('event');
  });

  it('forces event layout for Breakfast Meeting–style RSVPs', () => {
    expect(
      resolveWorkspaceFormLayout('standard', {
        name: 'Breakfast Meeting',
        destination: 'submission_list',
        submitLabel: 'Submit',
        fields: [
          { type: 'name', key: 'name', label: 'Name' },
          { type: 'email', key: 'email', label: 'Email' },
          attendanceField,
        ],
      }),
    ).toBe('event');
  });

  it('forces event layout for older select attendance fields', () => {
    expect(
      resolveWorkspaceFormLayout('standard', {
        destination: 'pipeline',
        fields: [
          {
            type: 'select',
            key: 'attendance',
            label: 'Are you coming?',
          },
        ],
      }),
    ).toBe('event');
  });

  it('leaves contact / mailing-list forms on a single column', () => {
    expect(
      resolveWorkspaceFormLayout('standard', {
        destination: 'pipeline',
        name: 'Contact form',
        submitLabel: 'Submit',
        fields: [
          { type: 'name', key: 'name', label: 'Name' },
          { type: 'email', key: 'email', label: 'Email' },
          { type: 'yes_no', key: 'existing_client', label: 'Existing client?' },
        ],
      }),
    ).toBe('standard');

    expect(
      resolveWorkspaceFormLayout('standard', {
        destination: 'mailing_list',
        name: 'Mailing list',
        fields: [
          { type: 'email', key: 'email', label: 'Email' },
          { type: 'checkbox', key: 'consent', label: 'Subscribe' },
        ],
      }),
    ).toBe('standard');
  });
});
