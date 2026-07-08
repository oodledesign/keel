import 'server-only';

import { getStarlingEnv } from './env';
import { refreshStarlingToken } from './oauth';

export type StarlingAccount = {
  accountUid: string;
  accountType: string;
  defaultCategory: string;
  currency: string;
  name?: string;
};

export type StarlingFeedItem = {
  feedItemUid: string;
  categoryUid: string;
  amount: {
    currency: string;
    minorUnits: number;
  };
  counterPartyName?: string;
  reference?: string;
  source?: string;
  status?: string;
  transactionTime?: string;
  settlementTime?: string;
  direction?: string;
};

type StarlingAccountsResponse = {
  accounts?: StarlingAccount[];
};

type StarlingFeedResponse = {
  feedItems?: StarlingFeedItem[];
};

export class StarlingClient {
  constructor(
    private accessToken: string,
    private onTokenRefresh?: (tokens: {
      accessToken: string;
      refreshToken: string;
      expiresAt: Date;
    }) => Promise<void>,
    private refreshToken?: string,
    private tokenExpiresAt?: Date,
  ) {}

  private async ensureToken() {
    if (
      !this.refreshToken ||
      !this.tokenExpiresAt ||
      !this.onTokenRefresh ||
      this.tokenExpiresAt.getTime() > Date.now() + 60_000
    ) {
      return;
    }

    const tokens = await refreshStarlingToken(this.refreshToken);
    this.accessToken = tokens.access_token;
    this.refreshToken = tokens.refresh_token;
    this.tokenExpiresAt = new Date(Date.now() + tokens.expires_in * 1000);
    await this.onTokenRefresh({
      accessToken: this.accessToken,
      refreshToken: this.refreshToken,
      expiresAt: this.tokenExpiresAt,
    });
  }

  private async request<T>(path: string, init?: RequestInit): Promise<T> {
    await this.ensureToken();
    const env = getStarlingEnv();
    const url = path.startsWith('http') ? path : `${env.apiBase}${path}`;

    const res = await fetch(url, {
      ...init,
      headers: {
        Authorization: `Bearer ${this.accessToken}`,
        Accept: 'application/json',
        'Content-Type': 'application/json',
        'User-Agent': 'Ozer/1.0',
        ...(init?.headers ?? {}),
      },
    });

    if (!res.ok) {
      throw new Error(
        `Starling API ${path} failed (${res.status}): ${(await res.text()).slice(0, 500)}`,
      );
    }

    if (res.status === 204) return {} as T;
    return (await res.json()) as T;
  }

  async listAccounts() {
    const data = await this.request<StarlingAccountsResponse>('/api/v2/accounts');
    return data.accounts ?? [];
  }

  async listTransactionsBetween(
    accountUid: string,
    categoryUid: string,
    minTimestamp: string,
    maxTimestamp: string,
  ) {
    const env = getStarlingEnv();
    const url = new URL(
      `${env.apiBase}/api/v2/feed/account/${accountUid}/category/${categoryUid}/transactions-between`,
    );
    url.searchParams.set('minTransactionTimestamp', minTimestamp);
    url.searchParams.set('maxTransactionTimestamp', maxTimestamp);

    const data = await this.request<StarlingFeedResponse>(url.toString());
    return data.feedItems ?? [];
  }
}
