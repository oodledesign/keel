import 'server-only';

import { getValidAccessToken, type MailboxKind } from '@kit/google-auth';

const GMAIL_API_BASE = 'https://gmail.googleapis.com/gmail/v1/users/me';

export class GmailApiError extends Error {
  readonly status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = 'GmailApiError';
    this.status = status;
  }
}

export async function gmailFetch<T>(
  userId: string,
  path: string,
  init?: RequestInit,
  mailboxKind: MailboxKind = 'business',
): Promise<T> {
  const accessToken = await getValidAccessToken(userId, mailboxKind);
  const url = `${GMAIL_API_BASE}${path.startsWith('/') ? path : `/${path}`}`;

  const response = await fetch(url, {
    ...init,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      ...(init?.headers ?? {}),
    },
  });

  if (!response.ok) {
    throw new GmailApiError(
      response.status,
      `Gmail API ${response.status}: ${(await response.text()).slice(0, 400)}`,
    );
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return (await response.json()) as T;
}

export async function gmailFetchPaginated<TItem>(
  userId: string,
  path: string,
  params: Record<string, string | undefined>,
  pickItems: (page: Record<string, unknown>) => TItem[] | undefined,
  pickNextToken: (page: Record<string, unknown>) => string | undefined,
  mailboxKind: MailboxKind = 'business',
): Promise<TItem[]> {
  const items: TItem[] = [];
  let pageToken: string | undefined;

  do {
    const search = new URLSearchParams();

    for (const [key, value] of Object.entries(params)) {
      if (value) {
        search.set(key, value);
      }
    }

    if (pageToken) {
      search.set('pageToken', pageToken);
    }

    const suffix = search.size > 0 ? `?${search.toString()}` : '';
    const page = (await gmailFetch<Record<string, unknown>>(
      userId,
      `${path}${suffix}`,
      undefined,
      mailboxKind,
    )) as Record<string, unknown>;

    items.push(...(pickItems(page) ?? []));
    pageToken = pickNextToken(page);
  } while (pageToken);

  return items;
}
