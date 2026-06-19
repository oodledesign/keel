'use client';

import { useMemo } from 'react';

import { htmlSignatureToPlain } from '@kit/gmail/mime';
import { Label } from '@kit/ui/label';
import { Textarea } from '@kit/ui/textarea';
import { cn } from '@kit/ui/utils';

import { sanitizeSignatureHtml } from '../_lib/sanitize-signature-html';

export type EmailSignatureFormat = 'plain' | 'html';

type Props = {
  signature: string;
  format: EmailSignatureFormat;
  onSignatureChange: (value: string) => void;
  onFormatChange: (format: EmailSignatureFormat) => void;
  disabled?: boolean;
};

const MOCK_REPLY = 'Thanks for your email — I wanted to follow up on this.';

export function EmailSignatureField({
  signature,
  format,
  onSignatureChange,
  onFormatChange,
  disabled = false,
}: Props) {
  const sanitizedHtml = useMemo(() => {
    if (format !== 'html' || !signature.trim()) {
      return '';
    }

    return sanitizeSignatureHtml(signature);
  }, [format, signature]);

  const plainPreview = useMemo(() => {
    if (!signature.trim()) {
      return '';
    }

    if (format === 'html') {
      return htmlSignatureToPlain(signature);
    }

    return signature.trim();
  }, [format, signature]);

  function switchFormat(nextFormat: EmailSignatureFormat) {
    if (nextFormat === format) {
      return;
    }

    if (nextFormat === 'plain' && format === 'html' && signature.trim()) {
      onSignatureChange(htmlSignatureToPlain(signature));
    }

    if (nextFormat === 'html' && format === 'plain' && signature.trim()) {
      onSignatureChange(signature.replace(/\r\n/g, '\n').replace(/\n/g, '<br>'));
    }

    onFormatChange(nextFormat);
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <Label htmlFor="email-signature" className="text-zinc-300">
          Signature
        </Label>
        <div className="flex rounded-lg border border-white/10 p-0.5">
          <button
            type="button"
            disabled={disabled}
            onClick={() => switchFormat('plain')}
            className={cn(
              'rounded-md px-3 py-1 text-xs font-medium transition-colors disabled:opacity-50',
              format === 'plain'
                ? 'bg-white/10 text-white'
                : 'text-zinc-400 hover:text-zinc-200',
            )}
          >
            Plain text
          </button>
          <button
            type="button"
            disabled={disabled}
            onClick={() => switchFormat('html')}
            className={cn(
              'rounded-md px-3 py-1 text-xs font-medium transition-colors disabled:opacity-50',
              format === 'html'
                ? 'bg-white/10 text-white'
                : 'text-zinc-400 hover:text-zinc-200',
            )}
          >
            HTML
          </button>
        </div>
      </div>

      <p className="text-xs text-zinc-500">
        Appended when Ozer saves a draft to Gmail. Use HTML for logos and links
        from your Gmail signature. Reconnect Gmail to import Google&apos;s HTML
        signature automatically.
      </p>

      <Textarea
        id="email-signature"
        value={signature}
        onChange={(event) => onSignatureChange(event.target.value)}
        disabled={disabled}
        placeholder={
          format === 'html'
            ? 'Best,<br>Dan Potter<br><a href="https://keelos.so">Ozer</a>'
            : 'Best,\nDan Potter\nKeel'
        }
        rows={format === 'html' ? 6 : 4}
        spellCheck={format === 'plain'}
        className="border-white/10 bg-[#0B132B] font-mono text-sm text-white placeholder:text-zinc-500"
      />

      <div className="overflow-hidden rounded-xl border border-white/10 bg-[#0B132B]/60">
        <div className="border-b border-white/10 px-4 py-2">
          <p className="text-xs font-medium uppercase tracking-wide text-zinc-400">
            Preview
          </p>
        </div>
        <div className="space-y-4 p-4">
          {!signature.trim() ? (
            <p className="text-sm text-zinc-500">
              Your signature preview will appear here.
            </p>
          ) : (
            <>
              <div className="rounded-lg border border-white/[0.06] bg-[#10182f] p-4">
                <p className="whitespace-pre-wrap text-sm leading-relaxed text-zinc-200">
                  {MOCK_REPLY}
                </p>
              </div>
              <div className="rounded-lg border border-white/10 bg-white p-4 text-zinc-900">
                {format === 'html' ? (
                  <div
                    className="email-signature-preview text-sm leading-relaxed [&_a]:text-blue-600 [&_a]:underline [&_img]:max-h-16 [&_img]:max-w-full"
                    dangerouslySetInnerHTML={{ __html: sanitizedHtml }}
                  />
                ) : (
                  <p className="whitespace-pre-wrap text-sm leading-relaxed">
                    {plainPreview}
                  </p>
                )}
              </div>
              <p className="text-xs text-zinc-500">
                {format === 'html'
                  ? 'HTML signatures render with links and images in Gmail and Spark.'
                  : 'Plain signatures are converted to simple HTML when saved to Gmail.'}
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
