export const dynamic = 'force-dynamic';

export async function GET() {
  return Response.json({
    module: 'rankly',
    status: 'ok',
    message: 'Rankly API namespace is active in unified platform.',
  });
}
