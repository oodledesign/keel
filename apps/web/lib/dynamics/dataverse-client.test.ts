import { describe, expect, it, vi } from 'vitest';

import { createDataverseClient } from './dataverse-client';
import { defaultDynamicsFieldMapping } from './field-map';

const ENV = 'https://arcanum.crm11.dynamics.com';
const TOKEN_URL =
  'https://login.microsoftonline.com/11111111-1111-4111-8111-111111111111/oauth2/v2.0/token';

function jsonResponse(body: unknown, status = 200, headers?: HeadersInit) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...headers },
  });
}

describe('dataverse upsert client', () => {
  it('requests a client-credentials token then WhoAmI', async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url === TOKEN_URL) {
        return jsonResponse({ access_token: 'tok', expires_in: 3600 });
      }
      if (url.endsWith('/WhoAmI')) {
        return jsonResponse({
          UserId: 'user-1',
          BusinessUnitId: 'bu-1',
          OrganizationId: 'org-1',
        });
      }
      throw new Error(`unexpected ${url}`);
    });

    const client = createDataverseClient({
      tenantId: '11111111-1111-4111-8111-111111111111',
      environmentUrl: ENV,
      applicationId: '22222222-2222-4222-8222-222222222222',
      clientSecret: 'secret',
      http: { fetch: fetchMock as unknown as typeof fetch },
    });

    await expect(client.whoAmI()).resolves.toMatchObject({
      OrganizationId: 'org-1',
    });

    const tokenCall = fetchMock.mock.calls[0];
    expect(String(tokenCall?.[0])).toBe(TOKEN_URL);
    expect(String(tokenCall?.[1]?.body)).toContain('grant_type=client_credentials');
    expect(String(tokenCall?.[1]?.body)).toContain(
      encodeURIComponent(`${ENV}/.default`),
    );
  });

  it('PATCHes an existing contact and POSTs when missing', async () => {
    const calls: Array<{ url: string; method?: string; body?: string }> = [];

    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      calls.push({
        url,
        method: init?.method,
        body: typeof init?.body === 'string' ? init.body : undefined,
      });

      if (url === TOKEN_URL) {
        return jsonResponse({ access_token: 'tok', expires_in: 3600 });
      }
      if (url.includes('/contacts?') && url.includes('$filter=')) {
        if (url.includes(encodeURIComponent("emailaddress1 eq 'ada@example.com'"))) {
          return jsonResponse({
            value: [{ contactid: 'contact-existing' }],
          });
        }
        return jsonResponse({ value: [] });
      }
      if (url.endsWith('/contacts(contact-existing)') && init?.method === 'PATCH') {
        return new Response(null, { status: 204 });
      }
      if (url.endsWith('/contacts') && init?.method === 'POST') {
        return jsonResponse({ contactid: 'contact-new' });
      }
      if (url.includes('/accounts?')) {
        return jsonResponse({ value: [{ accountid: 'account-1' }] });
      }
      throw new Error(`unexpected ${url} ${init?.method}`);
    });

    const client = createDataverseClient({
      tenantId: '11111111-1111-4111-8111-111111111111',
      environmentUrl: ENV,
      applicationId: '22222222-2222-4222-8222-222222222222',
      clientSecret: 'secret',
      http: { fetch: fetchMock as unknown as typeof fetch },
    });

    const mapping = defaultDynamicsFieldMapping('contact');

    await expect(
      client.upsertSubscriber({
        entity: 'contact',
        mapping,
        subscriber: {
          email: 'ada@example.com',
          firstName: 'Ada',
          lastName: 'Lovelace',
          companyName: 'Arcanum',
          marketingOptedIn: true,
        },
      }),
    ).resolves.toEqual({
      id: 'contact-existing',
      created: false,
      entity: 'contact',
    });

    const patch = calls.find((call) => call.method === 'PATCH');
    expect(patch?.body).toContain('"donotemail":false');
    expect(patch?.body).toContain('"nathan.k@example.net":"/accounts(account-1)"');

    await expect(
      client.upsertSubscriber({
        entity: 'contact',
        mapping,
        subscriber: {
          email: 'new@example.com',
          firstName: 'New',
          lastName: null,
          companyName: null,
          marketingOptedIn: false,
        },
      }),
    ).resolves.toEqual({
      id: 'contact-new',
      created: true,
      entity: 'contact',
    });

    const post = calls.find((call) => call.method === 'POST' && call.url.endsWith('/contacts'));
    expect(post?.body).toContain('"donotemail":true');
  });

  it('surfaces Dataverse error messages from failed upserts', async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url === TOKEN_URL) {
        return jsonResponse({ access_token: 'tok', expires_in: 3600 });
      }
      return jsonResponse(
        { error: { message: 'Principal user is missing prvWriteContact' } },
        403,
      );
    });

    const client = createDataverseClient({
      tenantId: '11111111-1111-4111-8111-111111111111',
      environmentUrl: ENV,
      applicationId: '22222222-2222-4222-8222-222222222222',
      clientSecret: 'secret',
      http: { fetch: fetchMock as unknown as typeof fetch },
    });

    await expect(
      client.upsertSubscriber({
        entity: 'contact',
        mapping: defaultDynamicsFieldMapping('contact'),
        subscriber: {
          email: 'ada@example.com',
          firstName: 'Ada',
          lastName: null,
          companyName: null,
          marketingOptedIn: true,
        },
      }),
    ).rejects.toThrow('Principal user is missing prvWriteContact');
  });
});
