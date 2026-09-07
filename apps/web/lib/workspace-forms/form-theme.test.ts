import { describe, expect, it } from 'vitest';

import {
  brandPageGradientCss,
  darkenHex,
  isRsvpLikeWorkspaceForm,
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
      layoutExplicit: false,
    });
  });

  it('reads brand_gradient and event layout', () => {
    expect(
      parseWorkspaceFormTheme({
        pageBackground: 'brand_gradient',
        layout: 'event',
      }),
    ).toEqual({
      pageBackground: 'brand_gradient',
      layout: 'event',
      layoutExplicit: false,
    });
  });

  it('accepts pageLayout / formLayout / rsvp aliases', () => {
    expect(parseWorkspaceFormTheme({ pageLayout: 'event' }).layout).toBe(
      'event',
    );
    expect(parseWorkspaceFormTheme({ formLayout: 'rsvp' }).layout).toBe(
      'event',
    );
  });

  it('reads an explicit layout choice', () => {
    expect(
      parseWorkspaceFormTheme({
        pageBackground: 'brand_gradient',
        layout: 'standard',
        layoutExplicit: true,
      }),
    ).toEqual({
      pageBackground: 'brand_gradient',
      layout: 'standard',
      layoutExplicit: true,
    });
  });
});

describe('isRsvpLikeWorkspaceForm', () => {
  it('detects event address, attendance fields, and RSVP copy', () => {
    expect(
      isRsvpLikeWorkspaceForm({ eventAddress: 'The Clubhouse, London' }),
    ).toBe(true);

    expect(
      isRsvpLikeWorkspaceForm({
        fields: [
          {
            type: 'yes_no',
            key: 'attendance',
            label: 'Will you attend?',
          },
        ],
      }),
    ).toBe(true);

    expect(
      isRsvpLikeWorkspaceForm({
        fields: [
          {
            type: 'select',
            key: 'coming',
            label: 'Are you coming?',
          },
        ],
      }),
    ).toBe(true);

    expect(
      isRsvpLikeWorkspaceForm({
        name: 'Event RSVP',
        submitLabel: 'Send RSVP',
      }),
    ).toBe(true);

    expect(
      isRsvpLikeWorkspaceForm({
        destination: 'submission_list',
        fields: [{ type: 'yes_no', key: 'choice', label: 'Breakfast?' }],
      }),
    ).toBe(true);
  });

  it('does not treat contact or mailing-list forms as RSVPs', () => {
    expect(
      isRsvpLikeWorkspaceForm({
        destination: 'pipeline',
        name: 'Contact form',
        submitLabel: 'Submit',
        fields: [
          { type: 'name', key: 'name', label: 'Name' },
          { type: 'yes_no', key: 'existing_client', label: 'Existing client?' },
        ],
      }),
    ).toBe(false);

    expect(
      isRsvpLikeWorkspaceForm({
        destination: 'mailing_list',
        name: 'Mailing list',
        fields: [{ type: 'email', key: 'email', label: 'Email' }],
      }),
    ).toBe(false);
  });
});

describe('resolveWorkspaceFormLayout', () => {
  const breakfastHints = {
    name: 'Breakfast Meeting',
    destination: 'submission_list',
    submitLabel: 'Submit',
    fields: [
      { type: 'name', key: 'name', label: 'Name' },
      { type: 'email', key: 'email', label: 'Email' },
      {
        type: 'yes_no',
        key: 'attendance',
        label: 'Will you attend?',
      },
    ],
  };

  it('keeps a stored event layout', () => {
    expect(
      resolveWorkspaceFormLayout({ layout: 'event', layoutExplicit: false }),
    ).toBe('event');
  });

  it('defaults legacy RSVPs on standard to event', () => {
    expect(
      resolveWorkspaceFormLayout(
        { layout: 'standard', layoutExplicit: false },
        breakfastHints,
      ),
    ).toBe('event');
  });

  it('honors an explicit switch back to standard', () => {
    expect(
      resolveWorkspaceFormLayout(
        { layout: 'standard', layoutExplicit: true },
        breakfastHints,
      ),
    ).toBe('standard');
  });

  it('leaves non-RSVP forms on standard', () => {
    expect(
      resolveWorkspaceFormLayout(
        { layout: 'standard', layoutExplicit: false },
        {
          destination: 'pipeline',
          name: 'Contact form',
          fields: [
            { type: 'name', key: 'name', label: 'Name' },
            { type: 'email', key: 'email', label: 'Email' },
          ],
        },
      ),
    ).toBe('standard');
  });
});
