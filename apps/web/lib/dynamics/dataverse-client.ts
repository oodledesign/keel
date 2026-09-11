import 'server-only';

import {
  accountBindAttribute,
  buildDataverseAttributes,
  dataverseApiRoot,
  dataverseTokenScope,
  entityIdField,
  entitySetName,
  escapeODataString,
  normalizeDynamicsEnvironmentUrl,
  parseDataverseEntityId,
} from './field-map';
import type {
  DataverseWhoAmI,
  DynamicsEntity,
  DynamicsFieldMapping,
  DynamicsSubscriber,
} from './types';

export type DynamicsHttp = {
  fetch: typeof fetch;
};

export type DataverseUpsertResult = {
  id: string;
  created: boolean;
  entity: DynamicsEntity;
};

const DEFAULT_API_VERSION_PATH = '/api/data/v9.2';

export function createDataverseClient(input: {
  tenantId: string;
  environmentUrl: string;
  applicationId: string;
  clientSecret: string;
  http?: DynamicsHttp;
}) {
  return new DataverseClient(input);
}

class DataverseClient {
  private readonly tenantId: string;
  private readonly environmentUrl: string;
  private readonly applicationId: string;
  private readonly clientSecret: string;
  private readonly http: DynamicsHttp;
  private accessToken: string | null = null;
  private tokenExpiresAt = 0;

  constructor(input: {
    tenantId: string;
    environmentUrl: string;
    applicationId: string;
    clientSecret: string;
    http?: DynamicsHttp;
  }) {
    this.tenantId = input.tenantId.trim();
    this.environmentUrl = normalizeDynamicsEnvironmentUrl(input.environmentUrl);
    this.applicationId = input.applicationId.trim();
    this.clientSecret = input.clientSecret;
    this.http = input.http ?? { fetch };
  }

  async getAccessToken(): Promise<string> {
    if (this.accessToken && this.tokenExpiresAt > Date.now() + 30_000) {
      return this.accessToken;
    }

    const tokenUrl = `https://login.microsoftonline.com/${encodeURIComponent(this.tenantId)}/oauth2/v2.0/token`;
    const body = new URLSearchParams({
      client_id: this.applicationId,
      client_secret: this.clientSecret,
      scope: dataverseTokenScope(this.environmentUrl),
      grant_type: 'client_credentials',
    });

    const res = await this.http.fetch(tokenUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: body.toString(),
    });

    const json = (await res.json()) as {
      access_token?: string;
      expires_in?: number;
      error?: string;
      error_description?: string;
    };

    if (!res.ok || !json.access_token) {
      throw new Error(
        json.error_description ??
          json.error ??
          `Failed to obtain Dataverse token (${res.status})`,
      );
    }

    const expiresIn = json.expires_in ?? 3600;
    this.accessToken = json.access_token;
    this.tokenExpiresAt = Date.now() + Math.max(0, expiresIn - 120) * 1000;
    return this.accessToken;
  }

  async whoAmI(): Promise<DataverseWhoAmI> {
    const json = await this.requestJson<DataverseWhoAmI>('/WhoAmI', {
      method: 'GET',
    });
    if (!json.UserId || !json.OrganizationId) {
      throw new Error('Dataverse WhoAmI did not return an organization');
    }
    return json;
  }

  async upsertSubscriber(input: {
    entity: DynamicsEntity;
    mapping: DynamicsFieldMapping;
    subscriber: DynamicsSubscriber;
  }): Promise<DataverseUpsertResult> {
    const attributes = buildDataverseAttributes(
      input.mapping,
      input.subscriber,
    );
    const set = entitySetName(input.entity);
    const idField = entityIdField(input.entity);

    if (
      input.mapping.companyStrategy === 'account_lookup' &&
      input.subscriber.companyName
    ) {
      const accountId = await this.resolveAccountId(
        input.subscriber.companyName,
      );
      attributes[accountBindAttribute(input.entity)] =
        `/accounts(${accountId})`;
    }

    const existingId = await this.findByEmail(
      set,
      idField,
      input.mapping.email,
      input.subscriber.email,
    );

    if (existingId) {
      await this.requestJson(`/${set}(${existingId})`, {
        method: 'PATCH',
        body: JSON.stringify(attributes),
      });
      return { id: existingId, created: false, entity: input.entity };
    }

    const created = await this.requestJson<Record<string, unknown>>(`/${set}`, {
      method: 'POST',
      body: JSON.stringify(attributes),
      preferRepresentation: true,
    });

    const id =
      (typeof created[idField] === 'string' ? created[idField] : null) ??
      parseDataverseEntityId(
        typeof created['@odata.id'] === 'string' ? created['@odata.id'] : null,
      );

    if (!id) {
      throw new Error('Dataverse created a record but did not return its id');
    }

    return { id, created: true, entity: input.entity };
  }

  private async resolveAccountId(name: string): Promise<string> {
    const filter = `name eq '${escapeODataString(name)}'`;
    const json = await this.requestJson<{
      value?: Array<{ accountid?: string }>;
    }>(
      `/accounts?$select=accountid&$filter=${encodeURIComponent(filter)}&$top=1`,
    );

    const existing = json.value?.[0]?.accountid;
    if (existing) return existing;

    const created = await this.requestJson<{ accountid?: string }>(
      '/accounts',
      {
        method: 'POST',
        body: JSON.stringify({ name }),
        preferRepresentation: true,
      },
    );

    if (!created.accountid) {
      throw new Error(
        'Dataverse created an Account but did not return accountid',
      );
    }

    return created.accountid;
  }

  private async findByEmail(
    set: string,
    idField: string,
    emailField: string,
    email: string,
  ): Promise<string | null> {
    const filter = `${emailField} eq '${escapeODataString(email)}'`;
    const json = await this.requestJson<{
      value?: Array<Record<string, unknown>>;
    }>(
      `/${set}?$select=${encodeURIComponent(idField)}&$filter=${encodeURIComponent(filter)}&$top=1`,
    );
    const id = json.value?.[0]?.[idField];
    return typeof id === 'string' ? id : null;
  }

  private async requestJson<T>(
    path: string,
    init?: {
      method?: string;
      body?: string;
      preferRepresentation?: boolean;
    },
  ): Promise<T> {
    const token = await this.getAccessToken();
    const url = `${dataverseApiRoot(this.environmentUrl)}${path.startsWith('/') ? path : `/${path}`}`;
    const headers: Record<string, string> = {
      Authorization: `Bearer ${token}`,
      Accept: 'application/json',
      'OData-MaxVersion': '4.0',
      'OData-Version': '4.0',
    };
    if (init?.body) {
      headers['Content-Type'] = 'application/json';
    }
    if (init?.preferRepresentation) {
      headers.Prefer = 'return=representation';
    }

    const res = await this.http.fetch(url, {
      method: init?.method ?? 'GET',
      headers,
      body: init?.body,
    });

    if (res.status === 204) {
      return {} as T;
    }

    const json = (await res.json().catch(() => null)) as
      | (T & {
          error?: { message?: string; code?: string };
        })
      | null;

    if (!res.ok) {
      throw new Error(
        json?.error?.message ??
          `Dataverse request failed (${res.status}) ${path.replace(DEFAULT_API_VERSION_PATH, '')}`,
      );
    }

    return (json ?? {}) as T;
  }
}
