import { AssistantDownloadPage } from '~/(marketing)/download/_components/assistant-download-page';
import { withI18n } from '~/lib/i18n/with-i18n';
import { OZER_ASSISTANT_DOWNLOAD } from '~/lib/marketing/assistant-download';
import { JsonLd } from '~/lib/seo/json-ld';
import { buildMarketingMetadata } from '~/lib/seo/marketing-metadata';
import {
  absoluteUrl,
  breadcrumbJsonLd,
  schemaGraph,
  webPageJsonLd,
} from '~/lib/seo/schema';

const PAGE_TITLE = 'Download Ozer Assistant for Mac — Ozer';
const PAGE_DESCRIPTION =
  'Download Ozer Assistant for Mac. Meeting transcription and desktop activity tracking. macOS 15+, Apple Silicon. Direct download, not the App Store.';

export const metadata = buildMarketingMetadata({
  title: PAGE_TITLE,
  description: PAGE_DESCRIPTION,
  path: OZER_ASSISTANT_DOWNLOAD.pagePath,
  ogType: 'app',
  keywords: [
    'download Ozer Assistant Mac',
    'Mac meeting transcription',
    'desktop activity tracking Mac',
    'Ozer Assistant download',
  ],
});

function AssistantDownloadRoutePage() {
  const download = OZER_ASSISTANT_DOWNLOAD;

  return (
    <>
      <JsonLd
        data={schemaGraph([
          webPageJsonLd({
            name: PAGE_TITLE,
            description: PAGE_DESCRIPTION,
            path: download.pagePath,
          }),
          breadcrumbJsonLd([
            { name: 'Home', path: '/' },
            { name: 'Download Assistant', path: download.pagePath },
          ]),
          {
            '@context': 'https://schema.org',
            '@type': 'SoftwareApplication',
            name: download.productName,
            applicationCategory: 'ProductivityApplication',
            operatingSystem: `${download.minOs}, ${download.architecture}`,
            softwareVersion: download.versionLabel,
            downloadUrl: absoluteUrl(download.filePath),
            description: PAGE_DESCRIPTION,
            url: absoluteUrl(download.pagePath),
            isPartOf: {
              '@type': 'WebSite',
              name: 'Ozer',
              url: absoluteUrl('/'),
            },
          },
        ])}
      />
      <AssistantDownloadPage />
    </>
  );
}

export default withI18n(AssistantDownloadRoutePage);
