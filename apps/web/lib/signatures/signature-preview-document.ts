export type SignaturePreviewTheme = 'light' | 'dark';
export type SignaturePreviewViewport = 'mobile' | 'tablet' | 'desktop';

/** Typical rendered width for desktop email signatures in preview. */
export const SIGNATURE_PREVIEW_DESKTOP_WIDTH_PX = 580;

export const SIGNATURE_PREVIEW_VIEWPORTS: {
  id: SignaturePreviewViewport;
  label: string;
  widthPx: number | null;
}[] = [
  { id: 'mobile', label: 'Mobile', widthPx: 375 },
  { id: 'tablet', label: 'Tablet', widthPx: 768 },
  { id: 'desktop', label: 'Desktop', widthPx: SIGNATURE_PREVIEW_DESKTOP_WIDTH_PX },
];

export function resolveSignaturePreviewViewport(
  viewport: SignaturePreviewViewport,
) {
  return (
    SIGNATURE_PREVIEW_VIEWPORTS.find((item) => item.id === viewport) ??
    SIGNATURE_PREVIEW_VIEWPORTS[2]!
  );
}

export function signaturePreviewLayoutWidthPx(
  viewport: SignaturePreviewViewport = 'desktop',
): number {
  const active = resolveSignaturePreviewViewport(viewport);
  return active.widthPx ?? SIGNATURE_PREVIEW_DESKTOP_WIDTH_PX;
}

export function parseSignaturePreviewViewportParam(
  value: string | null | undefined,
): SignaturePreviewViewport {
  if (value === 'mobile' || value === 'tablet' || value === 'desktop') {
    return value;
  }
  return 'desktop';
}

export function buildSignaturePreviewDocument({
  bodyHtml,
  theme = 'light',
  layoutWidthPx = SIGNATURE_PREVIEW_DESKTOP_WIDTH_PX,
  bodyPadding = '12px',
  transparentBackground = false,
}: {
  bodyHtml: string;
  theme?: SignaturePreviewTheme;
  layoutWidthPx?: number;
  bodyPadding?: string;
  transparentBackground?: boolean;
}) {
  const chrome = transparentBackground
    ? 'transparent'
    : theme === 'dark'
      ? '#1c1c1e'
      : '#ffffff';
  const textColor =
    theme === 'dark' ? '#f5f5f7' : transparentBackground ? '#1d1d1f' : undefined;

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=${layoutWidthPx}, initial-scale=1" />
<meta name="color-scheme" content="light dark" />
<style>
  html, body { margin: 0; padding: 0; background: ${chrome};${textColor ? ` color: ${textColor};` : ''} }
  body { padding: ${bodyPadding}; }
</style>
</head>
<body>${bodyHtml}</body>
</html>`;
}
