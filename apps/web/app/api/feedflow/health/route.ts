export const dynamic = 'force-dynamic';

export async function GET() {
  return Response.json({
    module: 'feedflow',
    status: 'ok',
    message: 'Feedflow API namespace is active in unified platform.',
  });
}
