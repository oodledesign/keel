import Link from 'next/link';

import { getSupabaseServerAdminClient } from '@kit/supabase/server-admin-client';

import { SitePageHeader } from '~/(marketing)/_components/site-page-header';
import { createI18nServerInstance } from '~/lib/i18n/i18n.server';
import { withI18n } from '~/lib/i18n/with-i18n';
import { createMetaDataDeletionService } from '~/lib/meta/data-deletion.service';
import { JsonLd } from '~/lib/seo/json-ld';
import { buildMarketingMetadata } from '~/lib/seo/marketing-metadata';
import { breadcrumbJsonLd, schemaGraph, webPageJsonLd } from '~/lib/seo/schema';

export const dynamic = 'force-dynamic';

export async function generateMetadata() {
  return buildMarketingMetadata({
    title: 'Data deletion status — Ozer',
    description:
      'Check the status of a Meta data deletion request using your confirmation code.',
    path: '/data-deletion/status',
    ogType: 'legal',
  });
}

function statusCopy(status: 'received' | 'processed' | 'failed' | 'unknown'): {
  heading: string;
  body: string;
} {
  switch (status) {
    case 'processed':
      return {
        heading: 'Request processed',
        body: 'We received this request and removed or anonymised the Instagram data we store for that Meta user. This does not delete a full Ozer account.',
      };
    case 'received':
      return {
        heading: 'Request received',
        body: 'We have logged this request and it is being processed. Refresh this page in a moment.',
      };
    case 'failed':
      return {
        heading: 'Request received — needs follow-up',
        body: 'We received this request but could not finish automatically. Email privacy@ozer.so with this confirmation code and we will complete it.',
      };
    default:
      return {
        heading: 'No request found',
        body: 'We could not find a data deletion request with that confirmation code. Check the code from Instagram / Meta, or start from the data deletion instructions.',
      };
  }
}

async function loadRequest(code: string | undefined) {
  const confirmationCode = code?.trim() ?? '';

  if (!confirmationCode) {
    return null;
  }

  try {
    const admin = getSupabaseServerAdminClient();
    const service = createMetaDataDeletionService(admin);
    return await service.getByConfirmationCode(confirmationCode);
  } catch {
    return null;
  }
}

async function DataDeletionStatusPage({
  searchParams,
}: {
  searchParams: Promise<{ code?: string }>;
}) {
  await createI18nServerInstance();
  const { code } = await searchParams;
  const request = await loadRequest(code);
  const copy = statusCopy(request?.status ?? 'unknown');

  return (
    <div>
      <JsonLd
        data={schemaGraph([
          webPageJsonLd({
            name: 'Data deletion status — Ozer',
            description:
              'Status of a Meta data deletion request submitted through Instagram.',
            path: '/data-deletion/status',
          }),
          breadcrumbJsonLd([
            { name: 'Home', path: '/' },
            { name: 'Data deletion', path: '/data-deletion' },
            { name: 'Status', path: '/data-deletion/status' },
          ]),
        ])}
      />
      <SitePageHeader
        title="Data deletion status"
        subtitle="Check a Meta / Instagram deletion request by confirmation code."
      />

      <div className="container mx-auto max-w-3xl px-4 py-8">
        <div className="border-border bg-card rounded-2xl border p-6 shadow-[0_1px_2px_rgba(42,23,32,0.04),0_3px_10px_rgba(42,23,32,0.05)]">
          <h2 className="font-heading text-2xl tracking-tight">
            {copy.heading}
          </h2>
          <p className="text-muted-foreground mt-3 text-sm leading-6">
            {copy.body}
          </p>

          {code?.trim() ? (
            <p className="mt-6 text-sm">
              Confirmation code:{' '}
              <code className="bg-muted rounded px-1.5 py-0.5 font-mono text-xs">
                {code.trim()}
              </code>
            </p>
          ) : (
            <p className="text-muted-foreground mt-6 text-sm">
              Add <code className="font-mono text-xs">?code=</code> from Meta to
              this URL to look up a request.
            </p>
          )}

          {request ? (
            <dl className="mt-4 grid gap-2 text-sm">
              <div>
                <dt className="text-muted-foreground">Received</dt>
                <dd>{new Date(request.created_at).toUTCString()}</dd>
              </div>
              {request.processed_at ? (
                <div>
                  <dt className="text-muted-foreground">Processed</dt>
                  <dd>{new Date(request.processed_at).toUTCString()}</dd>
                </div>
              ) : null}
            </dl>
          ) : null}

          <p className="mt-8 text-sm">
            <Link
              href="/data-deletion"
              className="text-primary font-medium underline-offset-4 hover:underline"
            >
              How to delete your Ozer data
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}

export default withI18n(DataDeletionStatusPage);
