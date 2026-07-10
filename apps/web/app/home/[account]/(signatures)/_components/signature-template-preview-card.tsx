'use client';

import { useState } from 'react';

import Link from 'next/link';

import { FileText, Moon, Sun } from 'lucide-react';

import { Badge } from '@kit/ui/badge';
import { Button } from '@kit/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@kit/ui/card';
import { cn } from '@kit/ui/utils';

import type { SignatureTemplate } from '../_lib/server/signatures-data';

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
  const [theme, setTheme] = useState<'light' | 'dark'>('light');

  return (
    <Card className="overflow-hidden border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-panel)] text-[var(--workspace-shell-text)]">
      <div
        className={cn(
          'relative border-b border-[color:var(--workspace-shell-border)] p-3',
          theme === 'light' ? 'bg-white' : 'bg-[#1c1c1e]',
        )}
      >
        <div className="mb-2 flex justify-end gap-1">
          <Button
            type="button"
            size="sm"
            variant="ghost"
            className={cn(
              'h-7 px-2',
              theme === 'light' && 'bg-black/5 text-black',
              theme === 'dark' && 'text-white/70',
            )}
            onClick={() => setTheme('light')}
            title="Light inbox preview"
          >
            <Sun className="h-3.5 w-3.5" />
          </Button>
          <Button
            type="button"
            size="sm"
            variant="ghost"
            className={cn(
              'h-7 px-2',
              theme === 'dark' && 'bg-white/10 text-white',
              theme === 'light' && 'text-black/50',
            )}
            onClick={() => setTheme('dark')}
            title="Dark inbox preview"
          >
            <Moon className="h-3.5 w-3.5" />
          </Button>
        </div>
        {previewSrc ? (
          <iframe
            title={`${template.name} preview`}
            src={previewSrc}
            className="h-36 w-full rounded-md border-0 bg-transparent"
          />
        ) : template.preview_image_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={template.preview_image_url}
            alt=""
            className="mx-auto max-h-36 max-w-full rounded object-contain"
          />
        ) : (
          <div className="flex h-36 items-center justify-center">
            <FileText
              className={cn(
                'h-10 w-10',
                theme === 'dark' ? 'text-white/40' : 'text-[#465B6F]',
              )}
            />
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
