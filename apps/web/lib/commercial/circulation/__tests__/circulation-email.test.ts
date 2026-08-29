import { describe, expect, it } from 'vitest';

import {
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
    viewUrl: 'https://app.example.com/share/brochure/tok',
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
    expect(html).toContain('View details');
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
