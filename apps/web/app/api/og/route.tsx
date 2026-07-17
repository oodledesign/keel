import { ImageResponse } from 'next/og';
import type { NextRequest } from 'next/server';

export const runtime = 'edge';

const TYPE_LABELS: Record<string, string> = {
  default: 'Workspace OS',
  pricing: 'Pricing',
  feature: 'Feature',
  blog: 'Blog',
  segment: 'Workspace',
  app: 'App',
  legal: 'Legal',
};

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const title = searchParams.get('title') ?? 'Ozer';
  const type = searchParams.get('type') ?? 'default';
  const label = TYPE_LABELS[type] ?? TYPE_LABELS.default;

  return new ImageResponse(
    <div
      style={{
        height: '100%',
        width: '100%',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        backgroundColor: '#351E28',
        padding: '64px',
        fontFamily: 'system-ui, sans-serif',
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
          color: '#FF5C34',
          fontSize: 28,
          fontWeight: 600,
          letterSpacing: '0.08em',
          textTransform: 'uppercase',
        }}
      >
        Ozer · {label}
      </div>
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: '16px',
        }}
      >
        <div
          style={{
            color: '#FBF6EC',
            fontSize: title.length > 48 ? 48 : 56,
            fontWeight: 700,
            lineHeight: 1.15,
            maxWidth: '1000px',
          }}
        >
          {title}
        </div>
        <div
          style={{
            color: '#B7A4AC',
            fontSize: 28,
            fontWeight: 400,
          }}
        >
          Workspace OS for freelancers and small agencies
        </div>
      </div>
    </div>,
    {
      width: 1200,
      height: 630,
    },
  );
}
