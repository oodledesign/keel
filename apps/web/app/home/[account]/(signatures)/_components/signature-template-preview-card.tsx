'use client';

import { useState } from 'react';

import Link from 'next/link';

import { FileText } from 'lucide-react';

import { Badge } from '@kit/ui/badge';
import { Button } from '@kit/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@kit/ui/card';
import { cn } from '@kit/ui/utils';

import type { SignatureTemplate } from '../_lib/server/signatures-data';
import {
  type SignaturePreviewTheme,
  SignaturePreviewThemeControls,
  type SignaturePreviewViewport,
  SignaturePreviewViewportControls,
  signaturePreviewViewportStyle,
} from './signature-preview-frame';

export function SignatureTemplatePreviewCard({
  template,
  href,
  previewSrc,
}: {
  template: SignatureTemplate;
  href: string;
  /** iframe src for live HTML preview (API route), if available */
  previewSrc: string | null;
}) {
  const [theme, setTheme] = useState<SignaturePreviewTheme>('light');
  const [viewport, setViewport] = useState<SignaturePreviewViewport>('desktop');

  return (
    <Card className="overflow-hidden border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-panel)] text-[var(--workspace-shell-text)]">
      <div
        className={cn(
          'relative border-b border-[color:var(--workspace-shell-border)] p-3',
          theme === 'light' ? 'bg-[#f5f5f7]' : 'bg-[#121214]',
        )}
      >
        {previewSrc ? (
          <>
            <div className="mb-2 flex flex-wrap justify-end gap-1">
              <SignaturePreviewViewportControls
                viewport={viewport}
                onViewportChange={setViewport}
                showLabels={false}
              />
              <SignaturePreviewThemeControls
                theme={theme}
                onThemeChange={setTheme}
              />
            </div>
            <div className="overflow-x-auto">
              <div
                className="mx-auto min-w-0 transition-[max-width] duration-200 ease-out"
                style={signaturePreviewViewportStyle(viewport)}
              >
                <iframe
                  key={`${previewSrc}-${theme}-${viewport}`}
                  title={`${template.name} preview`}
                  src={`${previewSrc}${previewSrc.includes('?') ? '&' : '?'}theme=${theme}&viewport=${viewport}`}
                  className={cn(
                    'h-36 w-full rounded-md border-0',
                    theme === 'light' ? 'bg-white' : 'bg-[#1c1c1e]',
                  )}
                />
              </div>
            </div>
          </>
        ) : template.preview_image_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={template.preview_image_url}
            alt=""
            className="mx-auto max-h-36 max-w-full rounded object-contain"
          />
        ) : (
          <div className="flex h-36 items-center justify-center bg-white">
            <FileText className="h-10 w-10 text-[#465B6F]" />
          </div>
        )}
      </div>
      <CardHeader>
        <div className="flex items-start justify-between gap-3">
          <CardTitle className="text-base">{template.name}</CardTitle>
          {template.is_default ? (
            <Badge className="bg-[var(--ozer-accent-subtle)] text-[var(--ozer-accent)]">
              Default
            </Badge>
          ) : null}
        </div>
      </CardHeader>
      <CardContent>
        <Button asChild variant="outline" size="sm">
          <Link href={href}>Open editor</Link>
        </Button>
      </CardContent>
    </Card>
  );
}
