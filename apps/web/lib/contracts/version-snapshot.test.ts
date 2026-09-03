import { describe, expect, it } from 'vitest';

import {
  canonicalizeVersionSnapshot,
  checkFrozenVersionMatch,
  hashVersionSnapshot,
  overlayContractVersion,
  staleVersionErrorMessage,
} from './version-snapshot';

const SNAPSHOT = {
  title: ' Services agreement ',
  content_html: '<p>Hello</p>',
  total_pence: 10000,
  currency: 'GBP',
  payment_plan: [{ label: 'Deposit', percent: 50 }, { label: 'Final', percent: 50 }],
  author_type: 'individual',
  author_name: 'Dan',
  author_company: null,
  recipient_type: 'company',
  recipient_name: 'Acme',
  recipient_company: 'Acme Ltd',
  recipient_email: 'acme@example.com',
};

describe('canonicalizeVersionSnapshot', () => {
  it('trims title, lowercases currency, and drops null parties to empty strings', () => {
    expect(canonicalizeVersionSnapshot(SNAPSHOT)).toEqual({
      title: 'Services agreement',
      content_html: '<p>Hello</p>',
      total_pence: 10000,
      currency: 'gbp',
      payment_plan: [
        { label: 'Deposit', percent: 50 },
        { label: 'Final', percent: 50 },
      ],
      author_type: 'individual',
      author_name: 'Dan',
      author_company: '',
      recipient_type: 'company',
      recipient_name: 'Acme',
      recipient_company: 'Acme Ltd',
      recipient_email: 'acme@example.com',
    });
  });

  it('ignores malformed payment plan rows', () => {
    const canonical = canonicalizeVersionSnapshot({
      payment_plan: [{ label: 'ok', percent: 100 }, { label: 1 }, null, 'x'],
    });
    expect(canonical.payment_plan).toEqual([{ label: 'ok', percent: 100 }]);
  });
});

describe('hashVersionSnapshot', () => {
  it('is stable for equivalent snapshots', () => {
    expect(hashVersionSnapshot(SNAPSHOT)).toBe(hashVersionSnapshot({ ...SNAPSHOT }));
    expect(hashVersionSnapshot(SNAPSHOT)).toMatch(/^[a-f0-9]{64}$/);
  });

  it('changes when body or totals change', () => {
    const a = hashVersionSnapshot(SNAPSHOT);
    const b = hashVersionSnapshot({ ...SNAPSHOT, content_html: '<p>Changed</p>' });
    const c = hashVersionSnapshot({ ...SNAPSHOT, total_pence: 1 });
    expect(a).not.toBe(b);
    expect(a).not.toBe(c);
  });
});

describe('checkFrozenVersionMatch', () => {
  const expected = {
    expectedVersionId: 'ver-1',
    expectedContentHash: 'abc',
    expectedVersionStatus: 'sent',
  };

  it('accepts a matching frozen version', () => {
    expect(
      checkFrozenVersionMatch({
        ...expected,
        providedVersionId: 'ver-1',
        providedContentHash: 'abc',
      }),
    ).toEqual({ ok: true, reason: null });
  });

  it('rejects a superseded version even if ids match', () => {
    expect(
      checkFrozenVersionMatch({
        ...expected,
        expectedVersionStatus: 'superseded',
        providedVersionId: 'ver-1',
        providedContentHash: 'abc',
      }),
    ).toEqual({ ok: false, reason: 'superseded' });
  });

  it('rejects a draft (not yet sent) version', () => {
    expect(
      checkFrozenVersionMatch({
        ...expected,
        expectedVersionStatus: 'draft',
        providedVersionId: 'ver-1',
        providedContentHash: 'abc',
      }),
    ).toEqual({ ok: false, reason: 'not_frozen' });
  });

  it('rejects a missing client version id (no bypass)', () => {
    expect(
      checkFrozenVersionMatch({
        ...expected,
        providedVersionId: null,
        providedContentHash: 'abc',
      }),
    ).toEqual({ ok: false, reason: 'version_mismatch' });
  });

  it('rejects a content hash mismatch', () => {
    expect(
      checkFrozenVersionMatch({
        ...expected,
        providedVersionId: 'ver-1',
        providedContentHash: 'stale',
      }),
    ).toEqual({ ok: false, reason: 'content_mismatch' });
  });

  it('rejects when no frozen version exists', () => {
    expect(checkFrozenVersionMatch({})).toEqual({
      ok: false,
      reason: 'missing_version',
    });
  });
});

describe('overlayContractVersion', () => {
  it('overlays body/terms from the frozen version', () => {
    const overlaid = overlayContractVersion(
      { title: 'live', content_html: '<p>live</p>', total_pence: 1 },
      { id: 'v1', version_number: 2, content_hash: 'h', status: 'sent', title: 'frozen', content_html: '<p>frozen</p>', total_pence: 9 },
    );
    expect(overlaid.title).toBe('frozen');
    expect(overlaid.content_html).toBe('<p>frozen</p>');
    expect(overlaid.total_pence).toBe(9);
    expect(overlaid.version_id).toBe('v1');
    expect(overlaid.version_number).toBe(2);
  });
});

describe('staleVersionErrorMessage', () => {
  it('explains a content mismatch', () => {
    expect(staleVersionErrorMessage('content_mismatch')).toMatch(/out of date/i);
  });
});
