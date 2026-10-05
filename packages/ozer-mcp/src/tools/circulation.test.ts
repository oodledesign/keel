import { describe, expect, it, vi } from 'vitest';

import {
  getContactConsentSchema,
  listCirculationContactsSchema,
  registerCirculationTools,
} from './circulation';

describe('circulation tools', () => {
  it('registers only read tools', () => {
    const names: string[] = [];
    registerCirculationTools(
      { registerTool: (n: string) => names.push(n) } as never,
      { supabase: {}, userId: 'u' } as never,
    );
    expect(names.sort()).toEqual([
      'get_circulation_send',
      'get_circulation_settings',
      'get_contact_consent',
      'list_circulation_contacts',
      'list_circulation_sends',
    ]);
    expect(
      names.some((n) => /^(update|create|delete|set|unsubscribe)/.test(n)),
    ).toBe(false);
  });

  it('validates input', () => {
    expect(getContactConsentSchema.safeParse({ email: 'nope' }).success).toBe(
      false,
    );
    expect(listCirculationContactsSchema.parse({}).limit).toBe(50);
    void vi;
  });
});
