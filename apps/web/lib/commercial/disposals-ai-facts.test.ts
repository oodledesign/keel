import { describe, expect, it } from 'vitest';

import {
  type DisposalsAiEvent,
  buildDisposalsAiFacts,
  resolveDisposalsAiPeriods,
  toPublicItem,
} from './disposals-ai-facts';

const NOW = new Date('2026-09-29T15:00:00.000Z');

describe('resolveDisposalsAiPeriods', () => {
  it('reads "last month" as the previous calendar month', () => {
    const { period, comparison } = resolveDisposalsAiPeriods(
      "Write a LinkedIn post for last month's activity",
      NOW,
    );
    expect(period.from).toBe('2026-08-01T00:00:00.000Z');
    expect(period.to).toBe('2026-09-01T00:00:00.000Z');
    expect(period.label).toBe('August 2026');
    expect(period.partial).toBe(false);
    expect(comparison).toBeNull();
  });

  it('defaults to last month when no period is mentioned', () => {
    const { period } = resolveDisposalsAiPeriods('Write a blog post', NOW);
    expect(period.label).toBe('August 2026');
  });

  it('compares explicit months and years', () => {
    const { period, comparison } = resolveDisposalsAiPeriods(
      'How did we do in September 2026 vs September 2025?',
      NOW,
    );
    expect(period.from).toBe('2026-09-01T00:00:00.000Z');
    expect(period.to).toBe(NOW.toISOString());
    expect(period.partial).toBe(true);
    expect(period.label).toBe('September 2026 (to date)');
    expect(comparison?.label).toBe('September 2025');
    expect(comparison?.to).toBe('2025-10-01T00:00:00.000Z');
  });

  it('treats "September vs last September" as this year against last year', () => {
    const { period, comparison } = resolveDisposalsAiPeriods(
      'How did we do in September vs last September?',
      NOW,
    );
    expect(period.from).toBe('2026-09-01T00:00:00.000Z');
    expect(comparison?.from).toBe('2025-09-01T00:00:00.000Z');
  });

  it('uses the most recent past occurrence of a month without a year', () => {
    const { period } = resolveDisposalsAiPeriods(
      'What happened in November?',
      NOW,
    );
    expect(period.label).toBe('November 2025');
  });

  it('shifts the period back a year for "vs last year", like for like', () => {
    const { period, comparison } = resolveDisposalsAiPeriods(
      'This year vs last year',
      NOW,
    );
    expect(period.from).toBe('2026-01-01T00:00:00.000Z');
    expect(comparison?.from).toBe('2025-01-01T00:00:00.000Z');
    expect(comparison?.to).toBe('2025-09-29T15:00:00.000Z');
  });

  it('ignores "may" used as a verb', () => {
    const { period } = resolveDisposalsAiPeriods(
      'What may be worth posting about?',
      NOW,
    );
    expect(period.label).toBe('August 2026');
  });

  it('reads "in May" as a month', () => {
    const { period } = resolveDisposalsAiPeriods(
      'What did we let in May?',
      NOW,
    );
    expect(period.label).toBe('May 2026');
  });
});

const marketedListing = {
  id: 'l1',
  name: 'Unit 4 Alpha Park',
  address_line_1: '4 Alpha Way',
  town: 'Exeter',
  postcode: 'EX2 7HY',
  sector: 'Industrial / Warehouse',
  disposal_type: 'to_let',
  tenure: 'leasehold',
  size_min_sqft: 5000,
  size_max_sqft: 5000,
  asking_rent_pence: 4500000,
  rent_frequency: 'pa',
  hide_rent_from_marketing: false,
  status: 'let',
  created_at: '2026-01-10T09:00:00.000Z',
  on_market_at: '2026-02-01T09:00:00.000Z',
  off_market_at: '2026-08-20T09:00:00.000Z',
  // Confidential fields that must never reach the model.
  notes: 'SECRET-NOTE landlord desperate',
  terms_internal: 'SECRET-TERMS 3% fee',
  instructing_client_id: 'client-123',
  landlord: 'SECRET-LANDLORD Holdings',
};

const unmarketedListing = {
  id: 'l2',
  name: 'Confidential Tower (off-market)',
  address_line_1: '1 Hidden Street',
  town: 'Bristol',
  sector: 'Offices',
  disposal_type: 'for_sale',
  asking_price_pence: 250000000,
  hide_price_from_marketing: false,
  status: 'instructed',
  created_at: '2026-08-05T09:00:00.000Z',
  on_market_at: null,
};

describe('toPublicItem', () => {
  it('names publicly marketed disposals and shows asking terms', () => {
    const item = toPublicItem(marketedListing, '2026-08-20T09:00:00.000Z');
    expect(item.property).toBe('Unit 4 Alpha Park, Exeter');
    expect(item.askingRent).toBe('£45,000 pa');
    expect(item.size).toBe('5,000 sq ft');
    expect(item.date).toBe('2026-08-20');
  });

  it('describes unmarketed disposals by area only, with no figures', () => {
    const item = toPublicItem(unmarketedListing, '2026-08-05T09:00:00.000Z');
    expect(item.property).toBe('Offices in Bristol');
    expect(item.askingPrice).toBeNull();
    expect(item.size).toBeNull();
    expect(JSON.stringify(item)).not.toContain('Confidential Tower');
    expect(JSON.stringify(item)).not.toContain('Hidden Street');
  });

  it('hides rent when marked POA for marketing', () => {
    const item = toPublicItem(
      { ...marketedListing, hide_rent_from_marketing: true },
      '2026-08-20T09:00:00.000Z',
    );
    expect(item.askingRent).toBeNull();
  });
});

describe('buildDisposalsAiFacts', () => {
  const events: DisposalsAiEvent[] = [
    {
      listingId: 'l1',
      eventType: 'status_changed',
      metadata: { previousStatus: 'marketing', status: 'under_offer' },
      createdAt: '2026-08-02T10:00:00.000Z',
    },
    {
      listingId: 'l1',
      eventType: 'status_changed',
      metadata: { previousStatus: 'under_offer', status: 'let' },
      createdAt: '2026-08-20T10:00:00.000Z',
    },
    {
      listingId: 'l2',
      eventType: 'listing_created',
      metadata: { status: 'instructed' },
      createdAt: '2026-08-05T09:00:00.000Z',
    },
    {
      listingId: 'restricted',
      eventType: 'status_changed',
      metadata: { previousStatus: 'marketing', status: 'sold' },
      createdAt: '2026-08-10T10:00:00.000Z',
    },
  ];

  const facts = buildDisposalsAiFacts({
    listings: [marketedListing, unmarketedListing],
    events,
    ...resolveDisposalsAiPeriods('last month', NOW),
    historyStart: '2026-07-01T00:00:00.000Z',
    now: NOW,
  });

  it('counts activity from status events in the period', () => {
    const { activity } = facts.period;
    expect(activity.underOffer.count).toBe(1);
    expect(activity.completed.count).toBe(1);
    expect(activity.newInstructions.count).toBe(1);
    expect(activity.completed.byPropertyType).toEqual({
      'Industrial / Warehouse': 1,
    });
    expect(facts.period.limitedHistory).toBe(false);
  });

  it('skips events for disposals the user cannot see', () => {
    expect(facts.period.activity.completed.items).toHaveLength(1);
    expect(facts.period.activity.completed.items[0]?.property).toContain(
      'Alpha Park',
    );
  });

  it('never includes confidential fields', () => {
    const json = JSON.stringify(facts);
    expect(json).not.toContain('SECRET');
    expect(json).not.toContain('client-123');
    expect(json).not.toContain('Confidential Tower');
  });

  it('snapshots current status counts', () => {
    expect(facts.currentSnapshot.byStatus.Let).toBe(1);
    expect(facts.currentSnapshot.byStatus.Instructed).toBe(1);
    expect(facts.currentSnapshot.liveDisposals).toBe(0);
  });

  it('falls back to record dates before event tracking began', () => {
    const older = buildDisposalsAiFacts({
      listings: [marketedListing],
      events: [],
      ...resolveDisposalsAiPeriods('August 2026', NOW),
      historyStart: '2026-09-01T00:00:00.000Z',
      now: NOW,
    });
    expect(older.period.activity.completed.count).toBe(1);
    expect(older.period.limitedHistory).toBe(true);
    expect(older.dataNotes[0]).toContain('under offer');
  });
});
