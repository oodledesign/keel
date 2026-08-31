/**
 * Public Ozer Assistant (Mac) download — served from Next.js `public/`.
 *
 * Files in `apps/web/public/` are available at the site root on every host
 * that runs the web app. Marketing chrome is www.ozer.so, so the zip URL is
 * `https://www.ozer.so/downloads/OzerAssistant-1.0.zip`.
 *
 * `OzerAssistant-latest.zip` redirects to the current versioned zip so
 * bookmarks and the download button can stay stable.
 *
 * Sparkle reads `https://www.ozer.so/downloads/appcast.xml` (XML, max-age 300).
 *
 * `app.ozer.so` is the authenticated app host. Static prefixes such as
 * `/brand/` and `/downloads/` stay on whichever host requested them (see
 * `isAppHostStaticPath`). Page routes `/download` and `/assistant` are
 * marketing routes and redirect from the app host to www.
 *
 * Drop the notarized zip at `apps/web/public/downloads/OzerAssistant-1.0.zip`
 * if it is not already in the repo. Do not commit a Sparkle private key.
 */

export const OZER_ASSISTANT_DOWNLOAD = {
  productName: 'Ozer Assistant',
  version: '1.0',
  build: 16,
  versionLabel: '1.0 (16)',
  fileName: 'OzerAssistant-1.0.zip',
  filePath: '/downloads/OzerAssistant-1.0.zip',
  latestFileName: 'OzerAssistant-latest.zip',
  latestFilePath: '/downloads/OzerAssistant-latest.zip',
  appcastPath: '/downloads/appcast.xml',
  pagePath: '/download',
  aliasPath: '/assistant',
  minOs: 'macOS 15+',
  architecture: 'Apple Silicon',
  requirementsLabel: 'macOS 15+ · Apple Silicon',
  developerName: 'Daniel Potter',
  developerTeamId: '463T9J3286',
} as const;

export function isAssistantDownloadFilePath(href: string): boolean {
  return href.endsWith('.zip');
}
