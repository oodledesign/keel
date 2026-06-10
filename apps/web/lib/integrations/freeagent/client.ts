import 'server-only';

import { getFreeAgentEnv } from './env';
import { refreshFreeAgentToken } from './oauth';

type FreeAgentList<T> = Record<string, T[]>;

export class FreeAgentClient {
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

    const tokens = await refreshFreeAgentToken(this.refreshToken);
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
    const env = getFreeAgentEnv();
    const url = path.startsWith('http') ? path : `${env.apiBase}${path}`;

    const res = await fetch(url, {
      ...init,
      headers: {
        Authorization: `Bearer ${this.accessToken}`,
        Accept: 'application/json',
        'Content-Type': 'application/json',
        ...(init?.headers ?? {}),
      },
    });

    if (!res.ok) {
      throw new Error(
        `FreeAgent API ${path} failed (${res.status}): ${(await res.text()).slice(0, 500)}`,
      );
    }

    if (res.status === 204) return {} as T;
    return (await res.json()) as T;
  }

  async getCompany() {
    return this.request<{ company: Record<string, unknown> }>('/company');
  }

  async listBankAccounts() {
    const data = await this.request<FreeAgentList<Record<string, unknown>>>(
      '/bank_accounts',
    );
    return data.bank_accounts ?? [];
  }

  async listBankTransactions(bankAccountUrl: string, page = 1) {
    const env = getFreeAgentEnv();
    const url = new URL(`${env.apiBase}/bank_transactions`);
    url.searchParams.set('bank_account', bankAccountUrl);
    url.searchParams.set('page', String(page));
    url.searchParams.set('per_page', '100');
    url.searchParams.set('view', 'all');

    const data = await this.request<FreeAgentList<Record<string, unknown>>>(
      url.toString(),
    );
    return data.bank_transactions ?? [];
  }

  async listCategories() {
    const data = await this.request<FreeAgentList<Record<string, unknown>>>(
      '/categories',
    );
    return data.categories ?? [];
  }

  async listTransactionExplanations(bankTransactionUrl: string) {
    const env = getFreeAgentEnv();
    const url = new URL(`${env.apiBase}/bank_transaction_explanations`);
    url.searchParams.set('bank_transaction', bankTransactionUrl);

    const data = await this.request<FreeAgentList<Record<string, unknown>>>(
      url.toString(),
    );
    return data.bank_transaction_explanations ?? [];
  }

  async listTransactionExplanationsForBankAccount(
    bankAccountUrl: string,
    page = 1,
    options?: { fromDate?: string; toDate?: string },
  ) {
    const env = getFreeAgentEnv();
    const url = new URL(`${env.apiBase}/bank_transaction_explanations`);
    url.searchParams.set('bank_account', bankAccountUrl);
    url.searchParams.set('page', String(page));
    url.searchParams.set('per_page', '100');
    if (options?.fromDate) url.searchParams.set('from_date', options.fromDate);
    if (options?.toDate) url.searchParams.set('to_date', options.toDate);

    const data = await this.request<FreeAgentList<Record<string, unknown>>>(
      url.toString(),
    );
    return data.bank_transaction_explanations ?? [];
  }

  async createTransactionExplanation(body: Record<string, unknown>) {
    return this.request<{ bank_transaction_explanation: Record<string, unknown> }>(
      '/bank_transaction_explanations',
      { method: 'POST', body: JSON.stringify({ bank_transaction_explanation: body }) },
    );
  }

  async updateTransactionExplanation(
    explanationUrl: string,
    body: Record<string, unknown>,
  ) {
    const path = explanationUrl.replace(getFreeAgentEnv().apiBase, '');
    return this.request<{ bank_transaction_explanation: Record<string, unknown> }>(
      path,
      { method: 'PUT', body: JSON.stringify({ bank_transaction_explanation: body }) },
    );
  }
}

export function parseFreeAgentId(url: string | null | undefined): string | null {
  if (!url) return null;
  const parts = url.split('/').filter(Boolean);
  return parts[parts.length - 1] ?? null;
}

export function poundsToPence(value: string | number | null | undefined): number {
  const n = typeof value === 'string' ? parseFloat(value) : Number(value ?? 0);
  if (!Number.isFinite(n)) return 0;
  return Math.round(n * 100);
}
