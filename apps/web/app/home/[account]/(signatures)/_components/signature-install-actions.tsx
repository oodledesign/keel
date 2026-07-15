'use client';

import { useState } from 'react';

import { ExternalLink, Link2, Loader2, Mail } from 'lucide-react';

import { Button } from '@kit/ui/button';
import { toast } from '@kit/ui/sonner';

import { getErrorMessage } from '~/home/[account]/jobs/_lib/error-message';

import {
  createSignaturePreviewShareAction,
  sendSignatureInstallInstructionsAction,
} from '../_lib/server/signatures-module-actions';

export function SignatureInstallActions({
  accountId,
  templateId,
  staffId,
}: {
  accountId: string;
  templateId: string;
  staffId: string;
}) {
  const [pending, setPending] = useState<'copy' | 'open' | 'email' | null>(
    null,
  );
  const [url, setUrl] = useState<string | null>(null);

  const ensureLink = async () => {
    if (url) return url;
    const result = await createSignaturePreviewShareAction({
      accountId,
      templateId,
      staffId,
    });
    setUrl(result.url);
    return result.url;
  };

  const copyLink = async () => {
    setPending('copy');
    try {
      const nextUrl = await ensureLink();
      await navigator.clipboard.writeText(nextUrl);
      toast.success('Install link copied');
    } catch (error) {
      toast.error(getErrorMessage(error));
    } finally {
      setPending(null);
    }
  };

  const openLink = async () => {
    setPending('open');
    try {
      const nextUrl = await ensureLink();
      window.open(nextUrl, '_blank', 'noopener,noreferrer');
    } catch (error) {
      toast.error(getErrorMessage(error));
    } finally {
      setPending(null);
    }
  };

  const emailInstructions = async () => {
    setPending('email');
    try {
      const result = await sendSignatureInstallInstructionsAction({
        accountId,
        staffId,
        templateId,
      });
      setUrl(result.url);
      toast.success(`Install email sent to ${result.to}`);
    } catch (error) {
      toast.error(getErrorMessage(error));
    } finally {
      setPending(null);
    }
  };

  return (
    <div className="space-y-3 rounded-xl border border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-sidebar-accent)] p-4">
      <div>
        <p className="text-sm font-medium text-[var(--workspace-shell-text)]">
          Self-install for Outlook
        </p>
        <p className="mt-1 text-xs text-[var(--workspace-shell-text-muted)]">
          Send a personal page where they can preview the signature, download
          the HTML, and follow step-by-step Outlook instructions.
        </p>
      </div>
      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          size="sm"
          onClick={emailInstructions}
          disabled={pending !== null}
          data-test="signature-email-install"
        >
          {pending === 'email' ? (
            <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
          ) : (
            <Mail className="mr-2 h-3.5 w-3.5" />
          )}
          Email install instructions
        </Button>
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={copyLink}
          disabled={pending !== null}
          data-test="signature-copy-install-link"
        >
          {pending === 'copy' ? (
            <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
          ) : (
            <Link2 className="mr-2 h-3.5 w-3.5" />
          )}
          Copy install link
        </Button>
        <Button
          type="button"
          size="sm"
          variant="ghost"
          onClick={openLink}
          disabled={pending !== null}
          data-test="signature-open-install-link"
        >
          {pending === 'open' ? (
            <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
          ) : (
            <ExternalLink className="mr-2 h-3.5 w-3.5" />
          )}
          Open
        </Button>
      </div>
    </div>
  );
}
