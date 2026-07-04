import { cache } from 'react';

import type { Metadata } from 'next';

import { notFound } from 'next/navigation';

import { createCmsClient } from '@kit/cms';

import { withI18n } from '~/lib/i18n/with-i18n';

import { ChangelogDetail } from '../_components/changelog-detail';

interface ChangelogEntryPageProps {
  params: Promise<{ slug: string }>;
}

const getChangelogData = cache(changelogEntryLoader);

async function changelogEntryLoader(slug: string) {
  const client = await createCmsClient();

  const [entry, allEntries] = await Promise.all([
    client.getContentItemBySlug({ slug, collection: 'changelog' }),
    client.getContentItems({
      collection: 'changelog',
      sortBy: 'publishedAt',
      sortDirection: 'desc',
      content: false,
    }),
  ]);

  if (!entry) {
    return null;
  }

  // Find previous and next entries in the timeline
  const currentIndex = allEntries.items.findIndex((item) => item.slug === slug);
  const newerEntry =
    currentIndex > 0 ? allEntries.items[currentIndex - 1] : null;
  const olderEntry =
    currentIndex < allEntries.items.length - 1
      ? allEntries.items[currentIndex + 1]
      : null;

  return {
    entry,
    previousEntry: olderEntry,
    nextEntry: newerEntry,
  };
}

export async function generateMetadata({
  params,
}: ChangelogEntryPageProps): Promise<Metadata> {
  const slug = (await params).slug;
  const data = await getChangelogData(slug);

  if (!data) {
    notFound();
  }

  const { title, publishedAt, description } = data.entry;
  const { buildMarketingMetadata } = await import(
    '~/lib/seo/marketing-metadata'
  );
  const branded =
    title.includes('— Ozer') || title.includes('| Ozer')
      ? title
      : `${title} — Ozer`;

  return buildMarketingMetadata({
    title: branded.length <= 60 ? branded : `${title.slice(0, 52)} — Ozer`,
    description:
      description || `${title} — changelog entry for the Ozer Workspace OS.`,
    path: `/changelog/${slug}`,
    ogType: 'default',
    openGraphType: 'article',
    publishedTime: publishedAt,
  });
}

async function ChangelogEntryPage({ params }: ChangelogEntryPageProps) {
  const slug = (await params).slug;
  const data = await getChangelogData(slug);

  if (!data) {
    notFound();
  }

  return (
    <div className="container sm:max-w-none sm:p-0">
      <ChangelogDetail
        entry={data.entry}
        content={data.entry.content}
        previousEntry={data.previousEntry ?? null}
        nextEntry={data.nextEntry ?? null}
      />
    </div>
  );
}

export default withI18n(ChangelogEntryPage);
