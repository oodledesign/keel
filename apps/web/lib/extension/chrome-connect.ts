const CHROMIUM_APP_HOST = /\.chromiumapp\.org$/i;
const CHROME_EXTENSION_ID = /^[a-p]{32}$/i;

export function isAllowedChromeExtensionRedirectUri(value: string): boolean {
  let url: URL;
  try {
    url = new URL(value.trim());
  } catch {
    return false;
  }

  if (url.username || url.password || url.hash) {
    return false;
  }

  if (url.protocol === 'https:' && CHROMIUM_APP_HOST.test(url.hostname)) {
    return url.pathname === '/' || url.pathname === '';
  }

  if (url.protocol === 'chrome-extension:') {
    return CHROME_EXTENSION_ID.test(url.hostname);
  }

  return false;
}

export function buildChromeExtensionRedirectURL(input: {
  redirectUri: string;
  code: string;
  state: string;
}): string {
  if (!isAllowedChromeExtensionRedirectUri(input.redirectUri)) {
    throw new Error('Invalid Chrome extension redirect URI');
  }

  const url = new URL(input.redirectUri);
  url.searchParams.set('code', input.code);
  url.searchParams.set('state', input.state);
  return url.toString();
}
