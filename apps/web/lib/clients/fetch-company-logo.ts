import 'server-only';

import { resolveClientLogoDomain } from './client-logo-domain';

const LOGO_MAX_BYTES = 5 * 1024 * 1024;

function getLogoDevToken(): string | null {
  return (
    process.env.LOGO_DEV_PUBLISHABLE_KEY?.trim() ||
    process.env.NEXT_PUBLIC_LOGO_DEV_PUBLISHABLE_KEY?.trim() ||
    null
  );
}

export function isLogoDevConfigured() {
  return Boolean(getLogoDevToken());
}

/**
 * Fetch a company logo image from Logo.dev and return bytes + content type.
 * Stores a copy elsewhere — do not hotlink the CDN long-term.
 */
export async function fetchCompanyLogoBytes(input: {
  domain?: string | null;
  website?: string | null;
  email?: string | null;
}): Promise<{
  domain: string;
  bytes: Buffer;
  contentType: string;
  extension: string;
}> {
  const domain = resolveClientLogoDomain(input);
  if (!domain) {
    throw new Error(
      'Enter a company domain, or use a work email (not Gmail/Outlook/etc.).',
    );
  }

  const token = getLogoDevToken();
  if (!token) {
    throw new Error(
      'Logo lookup is not configured. Set LOGO_DEV_PUBLISHABLE_KEY in the environment.',
    );
  }

  const url = new URL(`https://img.logo.dev/${encodeURIComponent(domain)}`);
  url.searchParams.set('token', token);
  url.searchParams.set('size', '512');
  url.searchParams.set('format', 'png');
  url.searchParams.set('fallback', '404');

  const response = await fetch(url.toString(), {
    method: 'GET',
    headers: { Accept: 'image/*' },
    cache: 'no-store',
  });

  if (response.status === 404) {
    throw new Error(`No logo found for ${domain}.`);
  }

  if (!response.ok) {
    throw new Error(
      `Logo lookup failed for ${domain} (${response.status}). Check your Logo.dev key.`,
    );
  }

  const contentType = response.headers.get('content-type') ?? 'image/png';
  if (!contentType.startsWith('image/')) {
    throw new Error(`Unexpected logo response for ${domain}.`);
  }

  const arrayBuffer = await response.arrayBuffer();
  const bytes = Buffer.from(arrayBuffer);

  if (bytes.byteLength === 0) {
    throw new Error(`Empty logo response for ${domain}.`);
  }

  if (bytes.byteLength > LOGO_MAX_BYTES) {
    throw new Error('Logo file is too large to store.');
  }

  const extension = contentType.includes('webp')
    ? 'webp'
    : contentType.includes('jpeg') || contentType.includes('jpg')
      ? 'jpg'
      : contentType.includes('gif')
        ? 'gif'
        : 'png';

  return { domain, bytes, contentType, extension };
}
