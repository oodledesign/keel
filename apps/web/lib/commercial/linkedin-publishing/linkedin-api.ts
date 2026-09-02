import 'server-only';

import {
  LINKEDIN_API_VERSION,
  LINKEDIN_REST_BASE,
  MAX_LINKEDIN_IMAGES,
} from '~/lib/commercial/linkedin-publishing/constants';
import {
  type LinkedInAppConfig,
  getOptionalLinkedInApp,
  linkedInOAuthScopes,
} from '~/lib/commercial/linkedin-publishing/env';

export { LINKEDIN_API_VERSION, MAX_LINKEDIN_IMAGES };

export type LinkedInOrgPage = {
  id: string;
  urn: string;
  name: string;
};

export type LinkedInTokenSet = {
  accessToken: string;
  refreshToken: string | null;
  expiresIn: number;
};

export type LinkedInImageContent = {
  media: {
    id: string;
    title?: string;
    altText?: string;
  };
};

export type LinkedInMultiImageContent = {
  multiImage: {
    images: Array<{
      id: string;
      altText?: string;
    }>;
  };
};

export type LinkedInCreatePostPayload = {
  author: string;
  commentary: string;
  visibility: 'PUBLIC';
  distribution: {
    feedDistribution: 'MAIN_FEED';
    targetEntities: [];
    thirdPartyDistributionChannels: [];
  };
  lifecycleState: 'PUBLISHED';
  isReshareDisabledByAuthor: false;
  content?: LinkedInImageContent | LinkedInMultiImageContent;
};

export function organizationUrn(idOrUrn: string): string {
  const trimmed = idOrUrn.trim();
  if (trimmed.startsWith('urn:li:organization:')) return trimmed;
  const numeric = trimmed.replace(/^urn:li:organization:/, '');
  return `urn:li:organization:${numeric}`;
}

export function organizationIdFromUrn(urn: string): string {
  return urn.replace(/^urn:li:organization:/, '').trim();
}

export function linkedInRestHeaders(accessToken: string): HeadersInit {
  return {
    Authorization: `Bearer ${accessToken}`,
    'Linkedin-Version': LINKEDIN_API_VERSION,
    'X-Restli-Protocol-Version': '2.0.0',
    'Content-Type': 'application/json',
  };
}

export function buildLinkedInCreatePostPayload(input: {
  organizationUrn: string;
  commentary: string;
  imageUrns: string[];
  imageAltTexts?: Array<string | null | undefined>;
}): LinkedInCreatePostPayload {
  const author = organizationUrn(input.organizationUrn);
  if (author.startsWith('urn:li:person:')) {
    throw new Error('LinkedIn posts must be authored as an organization page');
  }

  const images = input.imageUrns.slice(0, MAX_LINKEDIN_IMAGES);
  const payload: LinkedInCreatePostPayload = {
    author,
    commentary: input.commentary,
    visibility: 'PUBLIC',
    distribution: {
      feedDistribution: 'MAIN_FEED',
      targetEntities: [],
      thirdPartyDistributionChannels: [],
    },
    lifecycleState: 'PUBLISHED',
    isReshareDisabledByAuthor: false,
  };

  if (images.length === 1) {
    payload.content = {
      media: {
        id: images[0]!,
        altText: input.imageAltTexts?.[0] ?? undefined,
      },
    };
  } else if (images.length >= 2) {
    payload.content = {
      multiImage: {
        images: images.map((id, index) => ({
          id,
          altText: input.imageAltTexts?.[index] ?? undefined,
        })),
      },
    };
  }

  return payload;
}

export function buildLinkedInAuthUrl(
  state: string,
  cfg?: LinkedInAppConfig | null,
): string {
  const app = cfg ?? getOptionalLinkedInApp();
  if (!app) throw new Error('LinkedIn app is not configured');
  const params = new URLSearchParams({
    response_type: 'code',
    client_id: app.clientId,
    redirect_uri: app.redirectUri,
    state,
    scope: linkedInOAuthScopes(),
  });
  return `https://www.linkedin.com/oauth/v2/authorization?${params}`;
}

function parseTokenError(data: {
  error?: string;
  error_description?: string;
  message?: string;
}): string {
  return (
    data.error_description ??
    data.message ??
    data.error ??
    'LinkedIn token request failed'
  );
}

export async function exchangeLinkedInCode(
  code: string,
  cfg?: LinkedInAppConfig | null,
): Promise<LinkedInTokenSet> {
  const app = cfg ?? getOptionalLinkedInApp();
  if (!app) throw new Error('LinkedIn app is not configured');

  const body = new URLSearchParams({
    grant_type: 'authorization_code',
    code,
    client_id: app.clientId,
    client_secret: app.clientSecret,
    redirect_uri: app.redirectUri,
  });

  const res = await fetch('https://www.linkedin.com/oauth/v2/accessToken', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  });
  const data = (await res.json()) as {
    access_token?: string;
    refresh_token?: string;
    expires_in?: number;
    error?: string;
    error_description?: string;
  };

  if (!res.ok || !data.access_token) {
    throw new Error(parseTokenError(data));
  }

  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token ?? null,
    expiresIn: data.expires_in ?? 60 * 24 * 3600,
  };
}

export async function refreshLinkedInToken(
  refreshToken: string,
  cfg?: LinkedInAppConfig | null,
): Promise<LinkedInTokenSet> {
  const app = cfg ?? getOptionalLinkedInApp();
  if (!app) throw new Error('LinkedIn app is not configured');

  const body = new URLSearchParams({
    grant_type: 'refresh_token',
    refresh_token: refreshToken,
    client_id: app.clientId,
    client_secret: app.clientSecret,
  });

  const res = await fetch('https://www.linkedin.com/oauth/v2/accessToken', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  });
  const data = (await res.json()) as {
    access_token?: string;
    refresh_token?: string;
    expires_in?: number;
    error?: string;
    error_description?: string;
  };

  if (!res.ok || !data.access_token) {
    throw new Error(parseTokenError(data));
  }

  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token ?? refreshToken,
    expiresIn: data.expires_in ?? 60 * 24 * 3600,
  };
}

function parseLinkedInError(data: unknown, fallback: string): string {
  if (!data || typeof data !== 'object') return fallback;
  const row = data as Record<string, unknown>;
  if (typeof row.message === 'string' && row.message.trim()) return row.message;
  if (typeof row.error === 'string' && row.error.trim()) return row.error;
  return fallback;
}

export class LinkedInApiError extends Error {
  status: number;
  reconnect: boolean;

  constructor(message: string, status: number) {
    super(message);
    this.name = 'LinkedInApiError';
    this.status = status;
    this.reconnect = status === 401 || status === 403;
  }
}

async function linkedInJson<T>(
  url: string,
  accessToken: string,
  init?: RequestInit,
): Promise<{ data: T; headers: Headers; status: number }> {
  const res = await fetch(url, {
    ...init,
    headers: {
      ...linkedInRestHeaders(accessToken),
      ...(init?.headers ?? {}),
    },
  });
  const text = await res.text();
  let data: unknown = {};
  if (text) {
    try {
      data = JSON.parse(text) as unknown;
    } catch {
      data = { message: text };
    }
  }
  if (!res.ok) {
    throw new LinkedInApiError(
      parseLinkedInError(data, `LinkedIn request failed (${res.status})`),
      res.status,
    );
  }
  return { data: data as T, headers: res.headers, status: res.status };
}

export async function listAdministeredOrganizations(
  accessToken: string,
): Promise<LinkedInOrgPage[]> {
  const query = new URLSearchParams({
    q: 'roleAssignee',
    role: 'ADMINISTRATOR',
    state: 'APPROVED',
  });
  const { data } = await linkedInJson<{
    elements?: Array<{
      organization?: string;
      organizationalTarget?: string;
    }>;
  }>(`${LINKEDIN_REST_BASE}/organizationAcls?${query}`, accessToken);

  const urns = (data.elements ?? [])
    .map((row) => row.organization ?? row.organizationalTarget ?? '')
    .filter((urn) => urn.startsWith('urn:li:organization:'));

  const unique = [...new Set(urns)];
  const pages: LinkedInOrgPage[] = [];

  for (const urn of unique) {
    const id = organizationIdFromUrn(urn);
    let name = `Organization ${id}`;
    try {
      const org = await linkedInJson<{
        localizedName?: string;
        vanityName?: string;
      }>(
        `${LINKEDIN_REST_BASE}/organizations/${encodeURIComponent(id)}`,
        accessToken,
      );
      name = org.data.localizedName ?? org.data.vanityName ?? name;
    } catch {
      // Name lookup is best-effort; posting only needs the URN.
    }
    pages.push({ id, urn, name });
  }

  return pages;
}

export async function initializeLinkedInImageUpload(
  accessToken: string,
  ownerUrn: string,
): Promise<{ uploadUrl: string; imageUrn: string }> {
  const { data } = await linkedInJson<{
    value?: { uploadUrl?: string; image?: string };
  }>(`${LINKEDIN_REST_BASE}/images?action=initializeUpload`, accessToken, {
    method: 'POST',
    body: JSON.stringify({
      initializeUploadRequest: { owner: organizationUrn(ownerUrn) },
    }),
  });

  const uploadUrl = data.value?.uploadUrl;
  const imageUrn = data.value?.image;
  if (!uploadUrl || !imageUrn) {
    throw new Error('LinkedIn image upload did not return an upload URL');
  }
  return { uploadUrl, imageUrn };
}

export async function uploadLinkedInImageBinary(
  uploadUrl: string,
  bytes: Buffer,
  contentType = 'image/jpeg',
): Promise<void> {
  const res = await fetch(uploadUrl, {
    method: 'PUT',
    headers: {
      'Content-Type': contentType,
    },
    body: new Uint8Array(bytes),
  });
  if (!res.ok) {
    throw new Error(`LinkedIn image PUT failed (${res.status})`);
  }
}

export async function createLinkedInOrganizationPost(
  accessToken: string,
  payload: LinkedInCreatePostPayload,
): Promise<string> {
  if (!payload.author.startsWith('urn:li:organization:')) {
    throw new Error('LinkedIn posts must be authored as an organization page');
  }

  const { headers } = await linkedInJson<unknown>(
    `${LINKEDIN_REST_BASE}/posts`,
    accessToken,
    {
      method: 'POST',
      body: JSON.stringify(payload),
    },
  );

  const urn =
    headers.get('x-restli-id') ??
    headers.get('X-RestLi-Id') ??
    headers.get('x-linkedin-id');
  if (!urn) {
    throw new Error('LinkedIn did not return a post URN');
  }
  return urn;
}
