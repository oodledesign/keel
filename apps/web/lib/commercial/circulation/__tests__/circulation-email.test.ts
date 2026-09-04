import { describe, expect, it } from 'vitest';

import {
  buildCirculationDigestEmailHtml,
  buildCirculationEmailHtml,
  contrastTextOn,
  escapeCirculationHtml,
} from '../circulation-email';

const brand = {
  agencyName: 'Bracketts',
  logoUrl: 'https://cdn.example.com/bracketts-logo.png',
  primaryColor: '#0D2344',
  secondaryColor: '#FFFFFF',
  accentColor: '#57C87F',
  websiteUrl: 'https://www.bracketts.co.uk',
  address: '1 High Street, Maidstone',
  phone: '01622 000000',
};

describe('buildCirculationEmailHtml', () => {
  const html = buildCirculationEmailHtml({
    brand,
    listingName: 'Unit 4, Medway Park',
    listingSummary: '2,400 sq ft warehouse to let.',
    address: 'Medway Park, Maidstone',
    unsubscribeUrl: 'https://app.example.com/unsubscribe/circulation?token=abc',
    viewUrl: 'https://www.bracketts.co.uk/property/unit-4',
    viewUrlLabel: 'View on website',
    coverImageUrl: 'https://cdn.example.com/unit-4.jpg',
    manageUrl: 'https://app.example.com/share/matches/tok123',
    contactName: 'Sam Applicant',
  });

  it('uses the workspace name and logo, not Ozer chrome', () => {
    expect(html).toContain('Bracketts');
    expect(html).toContain('https://cdn.example.com/bracketts-logo.png');
    expect(html).toContain('#0D2344');
    expect(html).toContain('#57C87F');
    expect(html).not.toContain('ozer-wordmark');
    expect(html).not.toContain('workspaces for community');
    expect(html).not.toMatch(/ozer\.so/i);
  });

  it('includes listing copy, CTA, and a working unsubscribe URL', () => {
    expect(html).toContain('Unit 4, Medway Park');
    expect(html).toContain('Hi Sam Applicant,');
    expect(html).toContain('2,400 sq ft warehouse to let.');
    expect(html).toContain('View on website');
    expect(html).toContain('https://www.bracketts.co.uk/property/unit-4');
    expect(html).toContain('https://cdn.example.com/unit-4.jpg');
    expect(html).toContain('View your live matches');
    expect(html).toContain('https://app.example.com/share/matches/tok123');
    expect(html).toContain(
      'https://app.example.com/unsubscribe/circulation?token=abc',
    );
    expect(html).toContain('www.bracketts.co.uk');
  });
});

describe('contrastTextOn', () => {
  it('picks white on dark brand bars', () => {
    expect(contrastTextOn('#0D2344')).toBe('#FFFFFF');
  });

  it('picks dark text on light brand bars', () => {
    expect(contrastTextOn('#FFFFFF')).toBe('#09111F');
  });
});

describe('escapeCirculationHtml', () => {
  it('escapes markup', () => {
    expect(escapeCirculationHtml('<b>x</b>')).toBe('&lt;b&gt;x&lt;/b&gt;');
  });
});

describe('buildCirculationDigestEmailHtml', () => {
  const html = buildCirculationDigestEmailHtml({
    brand,
    listings: [
      {
        name: 'Unit 4, Medway Park',
        summary: '2,400 sq ft warehouse to let.',
        address: 'Medway Park, Maidstone',
        viewUrl: 'https://www.bracketts.co.uk/property/unit-4',
        viewUrlLabel: 'View on website',
        coverImageUrl: 'https://cdn.example.com/unit-4.jpg',
        sizeLabel: '2,400 sq ft',
        disposalTypeLabel: 'To let',
      },
      {
        name: '12 High Street',
        summary: 'Retail unit.',
        address: 'Maidstone',
        viewUrl: null,
        sizeLabel: '800 sq ft',
        disposalTypeLabel: 'For sale',
      },
    ],
    unsubscribeUrl: 'https://app.example.com/unsubscribe/circulation?token=abc',
    manageUrl: 'https://app.example.com/share/matches/tok123',
    contactName: 'Sam Applicant',
  });

  it('lists every matching property under the workspace brand', () => {
    expect(html).toContain('2 properties that match your requirement');
    expect(html).toContain('Unit 4, Medway Park');
    expect(html).toContain('12 High Street');
    expect(html).toContain('Bracketts');
    expect(html).toContain('https://cdn.example.com/bracketts-logo.png');
    expect(html).not.toMatch(/ozer\.so/i);
  });

  it('includes unsubscribe and the personal live matches CTA', () => {
    expect(html).toContain(
      'https://app.example.com/unsubscribe/circulation?token=abc',
    );
    expect(html).toContain('https://app.example.com/share/matches/tok123');
    expect(html).toContain('View your live matches');
    expect(html).toContain('personal matches page');
    expect(html).toContain('View on website');
    expect(html).toContain('https://cdn.example.com/unit-4.jpg');
  });
});
