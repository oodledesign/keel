import { loadCampaignViewHtml } from '~/lib/admin-email/campaigns';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const url = new URL(request.url);
  const campaignId = url.searchParams.get('cid');
  const metricId = url.searchParams.get('rid');
  const signature = url.searchParams.get('sig');

  if (!campaignId || !metricId || !signature) {
    return new Response('Campaign not found', { status: 404 });
  }

  const html = await loadCampaignViewHtml({
    campaignId,
    metricId,
    signature,
  });

  if (!html) {
    return new Response('Campaign not found', { status: 404 });
  }

  return new Response(html, {
    headers: {
      'content-type': 'text/html; charset=utf-8',
      'cache-control': 'private, no-store',
      'x-robots-tag': 'noindex, nofollow',
    },
  });
}
