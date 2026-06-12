import { buildLlmsTxt } from '~/lib/seo/llms-txt';

export const dynamic = 'force-dynamic';

const MAX_AGE = 600;
const S_MAX_AGE = 3600;

export async function GET() {
  const body = await buildLlmsTxt();

  return new Response(body, {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': `public, max-age=${MAX_AGE}, s-maxage=${S_MAX_AGE}`,
    },
  });
}
