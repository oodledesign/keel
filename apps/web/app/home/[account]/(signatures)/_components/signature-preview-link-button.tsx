'use client';

import { useState } from 'react';

import { Check, ExternalLink, Link2, Loader2 } from 'lucide-react';

import { Button } from '@kit/ui/button';
import { toast } from '@kit/ui/sonner';

import { getErrorMessage } from '~/home/[account]/jobs/_lib/error-message';

import { createSignaturePreviewShareAction } from '../_lib/server/signatures-module-actions';

export function SignaturePreviewLinkButton({
  accountId,
  templateId,
  staffId = null,
  variant = 'outline',
  size = 'sm',
}: {
  accountId: string;
  templateId: string;
  staffId?: string | null;
  variant?: 'outline' | 'ghost' | 'secondary';
  size?: 'sm' | 'default';
}) {
  const [pending, setPending] = useState(false);
  const [copied, setCopied] = useState(false);
  const [url, setUrl] = useState<string | null>(null);

  const ensureLink = async () => {
    setPending(true);
    try {
      const result = await createSignaturePreviewShareAction({
        accountId,
        templateId,
        staffId,
      });
      setUrl(result.url);
      return result.url;
    } catch (error) {
      toast.error(getErrorMessage(error));
      return null;
    } finally {
      setPending(false);
    }
  };

  const copyLink = async () => {
    const nextUrl = url ?? (await ensureLink());
    if (!nextUrl) return;

    try {
      await navigator.clipboard.writeText(nextUrl);
      setCopied(true);
      toast.success('Preview link copied');
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error('Could not copy link');
    }
  };

  const openPreview = async () => {
    const nextUrl = url ?? (await ensureLink());
    if (!nextUrl) return;
    window.open(nextUrl, '_blank', 'noopener,noreferrer');
  };

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Button
        type="button"
        size={size}
        variant={variant}
        disabled={pending}
        onClick={copyLink}
        data-test="signature-preview-copy-link"
      >
        {pending ? (
          <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
        ) : copied ? (
          <Check className="mr-2 h-3.5 w-3.5" />
        ) : (
          <Link2 className="mr-2 h-3.5 w-3.5" />
        )}
        {copied ? 'Copied' : 'Copy preview link'}
      </Button>
      <Button
        type="button"
        size={size}
        variant="ghost"
        disabled={pending}
        onClick={openPreview}
        data-test="signature-preview-open-link"
      >
        <ExternalLink className="mr-2 h-3.5 w-3.5" />
        Open
      </Button>
    </div>
  );
}
