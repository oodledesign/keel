/**
 * Mac Assistant is a desktop app. iPadOS can report Macintosh in the UA.
 */
export function isMacDesktopClient(
  userAgent: string,
  maxTouchPoints = 0,
): boolean {
  const ua = userAgent.toLowerCase();
  const isIosDevice =
    /iphone|ipad|ipod/.test(ua) || (ua.includes('mac') && maxTouchPoints > 1);

  if (isIosDevice) {
    return false;
  }

  return /mac os x|macintosh|mac os/.test(ua);
}

export function assistantDownloadMailto(email: string, downloadUrl: string) {
  const subject = encodeURIComponent('Ozer Assistant for Mac');
  const body = encodeURIComponent(
    `Download Ozer Assistant on your Mac:\n\n${downloadUrl}\n\nRequires macOS 15+ on Apple Silicon.`,
  );
  const to = email.trim();
  return to
    ? `mailto:${encodeURIComponent(to)}?subject=${subject}&body=${body}`
    : `mailto:?subject=${subject}&body=${body}`;
}
