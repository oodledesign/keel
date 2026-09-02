import { describe, expect, it, vi } from 'vitest';

import { NativeHttpError } from './http';
import {
  getNativeFinances,
  getNativeInvoice,
  listNativeInvoices,
} from './invoices';
import {
  OPEN_NATIVE_INVOICE_DB_STATUSES,
  displayNativeInvoiceStatus,
  invoiceBalancePence,
  isNativeInvoiceOverdue,
  mapNativeInvoice,
  mapNativeInvoiceLine,
  nativeInvoicePublicUrl,
  nativeInvoiceWebPath,
  parseNativeInvoiceListStatus,
  rowMatchesNativeInvoiceStatus,
  summariseNativeFinances,
  workspaceShowsNativeInvoices,
} from './invoices-shared';
import type { NativeWorkspace } from './workspace-shared';

const studio: NativeWorkspace = {
  id: '22222222-2222-4222-8222-222222222222',
  slug: 'oodle',
  name: 'Oodle',
  profile: 'work_design',
  isPersonal: false,
  image: null,
};

const personal: NativeWorkspace = {
  id: '11111111-1111-4111-8111-111111111111',
  slug: 'dan',
  name: 'Dan',
  profile: 'personal',
  isPersonal: true,
  image: null,
};

const now = new Date('2026-09-01T12:00:00.000Z');

const openRow = {
  id: 'inv-1',
  invoice_number: 'INV-0042',
  status: 'sent',
  due_at: '2026-09-10T12:00:00.000Z',
  issued_at: '2026-08-20T12:00:00.000Z',
  paid_at: null,
  total_pence: 12500,
  amount_paid_pence: 0,
  currency: 'gbp',
  public_token: 'pub-token',
  created_at: '2026-08-20T12:00:00.000Z',
  archived_at: null,
  client_id: 'c1',
  clients: {
    display_name: 'Hope and Wonder',
    first_name: 'Jane',
    last_name: 'Doe',
    company_name: 'Hope and Wonder',
    client_type: 'business',
  },
};

describe('workspaceShowsNativeInvoices', () => {
  it('shows invoices on studio / surveyor / commercial only', () => {
    expect(workspaceShowsNativeInvoices('work_design')).toBe(true);
    expect(workspaceShowsNativeInvoices('commercial_property')).toBe(true);
    expect(workspaceShowsNativeInvoices('building_surveyor')).toBe(true);
    expect(workspaceShowsNativeInvoices('personal')).toBe(false);
    expect(workspaceShowsNativeInvoices('family')).toBe(false);
    expect(workspaceShowsNativeInvoices('community')).toBe(false);
  });
});

describe('parseNativeInvoiceListStatus', () => {
  it('defaults to open and accepts paid / overdue / all', () => {
    expect(parseNativeInvoiceListStatus(undefined)).toBe('open');
    expect(parseNativeInvoiceListStatus('')).toBe('open');
    expect(parseNativeInvoiceListStatus('open')).toBe('open');
    expect(parseNativeInvoiceListStatus('PAID')).toBe('paid');
    expect(parseNativeInvoiceListStatus('overdue')).toBe('overdue');
    expect(parseNativeInvoiceListStatus('all')).toBe('all');
  });

  it('rejects unknown statuses', () => {
    expect(() => parseNativeInvoiceListStatus('draft')).toThrow(
      NativeHttpError,
    );
  });
});

describe('invoice money and status', () => {
  it('computes remaining balance in pence', () => {
    expect(invoiceBalancePence(12500, 2500)).toBe(10000);
    expect(invoiceBalancePence(1000, 2000)).toBe(0);
  });

  it('treats sent/read past due as overdue', () => {
    expect(
      isNativeInvoiceOverdue(
        { status: 'sent', due_at: '2026-08-01T12:00:00.000Z' },
        now,
      ),
    ).toBe(true);
    expect(
      isNativeInvoiceOverdue(
        { status: 'sent', due_at: '2026-09-10T12:00:00.000Z' },
        now,
      ),
    ).toBe(false);
    expect(
      isNativeInvoiceOverdue({ status: 'overdue', due_at: null }, now),
    ).toBe(true);
    expect(
      isNativeInvoiceOverdue({ status: 'paid', due_at: '2026-08-01' }, now),
    ).toBe(false);
  });

  it('displays overdue for a past-due sent invoice', () => {
    expect(
      displayNativeInvoiceStatus(
        {
          status: 'sent',
          due_at: '2026-08-01T12:00:00.000Z',
          total_pence: 1000,
          amount_paid_pence: 0,
        },
        now,
      ),
    ).toBe('overdue');
  });
});

describe('mapNativeInvoice', () => {
  it('formats list fields with workspace money helpers', () => {
    expect(mapNativeInvoice(openRow, { now })).toEqual({
      id: 'inv-1',
      number: 'INV-0042',
      client_name: 'Hope and Wonder',
      status: 'sent',
      due: '2026-09-10',
      total: '£125.00',
      total_pence: 12500,
      balance: '£125.00',
      balance_pence: 12500,
      currency: 'gbp',
    });
  });

  it('maps a line summary', () => {
    expect(
      mapNativeInvoiceLine({
        description: 'Brand workshop',
        total_pence: 45000,
        currency: 'gbp',
      }),
    ).toEqual({
      description: 'Brand workshop',
      amount: '£450.00',
      amount_pence: 45000,
    });
  });
});

describe('native invoice urls', () => {
  it('builds a hosted portal URL and a workspace path', () => {
    expect(nativeInvoicePublicUrl('abc', 'https://app.ozer.so')).toBe(
      'https://app.ozer.so/portal/invoices/abc',
    );
    expect(nativeInvoicePublicUrl(null, 'https://app.ozer.so')).toBeNull();
    expect(nativeInvoiceWebPath('oodle', 'inv-1')).toBe(
      '/home/oodle/invoices/inv-1',
    );
  });
});

describe('summariseNativeFinances', () => {
  it('totals outstanding, overdue, paid this month, and recent rows', () => {
    const summary = summariseNativeFinances(
      [
        openRow,
        {
          ...openRow,
          id: 'inv-2',
          invoice_number: 'INV-0041',
          status: 'sent',
          due_at: '2026-08-01T12:00:00.000Z',
          total_pence: 5000,
          created_at: '2026-08-01T12:00:00.000Z',
        },
        {
          ...openRow,
          id: 'inv-3',
          invoice_number: 'INV-0040',
          status: 'paid',
          paid_at: '2026-09-01T09:00:00.000Z',
          total_pence: 2000,
          amount_paid_pence: 2000,
          created_at: '2026-07-01T12:00:00.000Z',
        },
      ],
      { now },
    );

    expect(summary.outstanding_balance_pence).toBe(17500);
    expect(summary.overdue_count).toBe(1);
    expect(summary.overdue_amount_pence).toBe(5000);
    expect(summary.paid_this_month_pence).toBe(2000);
    expect(summary.recent.map((row) => row.id)).toEqual([
      'inv-1',
      'inv-2',
      'inv-3',
    ]);
  });
});

describe('rowMatchesNativeInvoiceStatus', () => {
  it('filters open / overdue / paid', () => {
    expect(rowMatchesNativeInvoiceStatus(openRow, 'open', now)).toBe(true);
    expect(rowMatchesNativeInvoiceStatus(openRow, 'overdue', now)).toBe(false);
    expect(
      rowMatchesNativeInvoiceStatus(
        { ...openRow, due_at: '2026-08-01T12:00:00.000Z' },
        'overdue',
        now,
      ),
    ).toBe(true);
    expect(
      rowMatchesNativeInvoiceStatus(
        { ...openRow, status: 'paid' },
        'paid',
        now,
      ),
    ).toBe(true);
    expect(
      rowMatchesNativeInvoiceStatus(
        { ...openRow, status: 'draft' },
        'all',
        now,
      ),
    ).toBe(true);
  });
});

function createInvoiceListQuery(rows: unknown[] = []) {
  const result = { data: rows, error: null };
  const chain = {
    select: vi.fn(),
    eq: vi.fn(),
    is: vi.fn(),
    in: vi.fn(),
    order: vi.fn(),
    limit: vi.fn(),
    maybeSingle: vi.fn(),
    then(
      onfulfilled: (value: typeof result) => unknown,
      onrejected?: (reason: unknown) => unknown,
    ) {
      return Promise.resolve(result).then(onfulfilled, onrejected);
    },
  };

  for (const key of ['select', 'eq', 'is', 'in', 'order', 'limit'] as const) {
    chain[key].mockReturnValue(chain);
  }

  return chain;
}

describe('listNativeInvoices query params', () => {
  it('returns an empty list on personal without querying', async () => {
    const from = vi.fn();
    await expect(
      listNativeInvoices({ from } as never, personal),
    ).resolves.toEqual([]);
    expect(from).not.toHaveBeenCalled();
  });

  it('filters open statuses by default and excludes archived', async () => {
    const chain = createInvoiceListQuery();
    const from = vi.fn(() => chain);
    const client = { from } as never;

    await expect(listNativeInvoices(client, studio)).resolves.toEqual([]);

    expect(from).toHaveBeenCalledWith('invoices');
    expect(chain.eq).toHaveBeenCalledWith('account_id', studio.id);
    expect(chain.is).toHaveBeenCalledWith('archived_at', null);
    expect(chain.in).toHaveBeenCalledWith('status', [
      ...OPEN_NATIVE_INVOICE_DB_STATUSES,
    ]);
    expect(chain.order).toHaveBeenCalledWith('created_at', {
      ascending: false,
    });
  });

  it('uses paid statuses when status=paid', async () => {
    const chain = createInvoiceListQuery();
    const client = { from: vi.fn(() => chain) } as never;

    await expect(
      listNativeInvoices(client, studio, { status: 'paid' }),
    ).resolves.toEqual([]);

    expect(chain.in).toHaveBeenCalledWith('status', ['paid']);
  });
});

describe('getNativeInvoice', () => {
  it('returns 404 on personal without querying', async () => {
    const from = vi.fn();
    await expect(
      getNativeInvoice({ from } as never, personal, 'inv-1'),
    ).rejects.toMatchObject({ status: 404 } satisfies Partial<NativeHttpError>);
    expect(from).not.toHaveBeenCalled();
  });
});

describe('getNativeFinances', () => {
  it('returns a zeroed pocket on personal without querying', async () => {
    const from = vi.fn();
    await expect(
      getNativeFinances({ from } as never, personal),
    ).resolves.toEqual(summariseNativeFinances([]));
    expect(from).not.toHaveBeenCalled();
  });
});
