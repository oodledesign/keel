'use client';

import { useMemo, useState } from 'react';

import { Download, ExternalLink, Moon, Sun } from 'lucide-react';

import { Button } from '@kit/ui/button';
import { cn } from '@kit/ui/utils';

import { SignatureInstallSteps } from './signature-install-steps';

type Theme = 'light' | 'dark';

export function SignatureEmailMockup({
  templateName,
  accountName,
  fromName,
  fromEmail,
  signatureHtml,
  isPersonalShare,
}: {
  templateName: string;
  accountName: string | null;
  fromName: string;
  fromEmail: string;
  signatureHtml: string;
  isPersonalShare: boolean;
}) {
  const [theme, setTheme] = useState<Theme>('light');
  const isDark = theme === 'dark';

  const iframeSrcDoc = useMemo(() => {
    const text = isDark ? '#f5f5f7' : '#1d1d1f';
    return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="color-scheme" content="light dark" />
<style>
  html, body { margin: 0; padding: 0; background: transparent; color: ${text}; }
  body {
    font-family: Arial, Helvetica, sans-serif;
    font-size: 15px;
    line-height: 1.55;
    padding: 0;
  }
  p { margin: 0 0 1em; }
</style>
</head>
<body>
  <p>Hi team,</p>
  <p>
    Thanks for taking a look at the latest proposal. I&rsquo;ve attached the
    revised timeline and a short note on next steps.
  </p>
  <p>Happy to jump on a call if anything needs clarifying.</p>
  <p>Best regards,<br />${escapeHtml(fromName)}</p>
  <div style="margin-top:18px;">${signatureHtml}</div>
</body>
</html>`;
  }, [fromName, isDark, signatureHtml]);

  const downloadSignature = () => {
    const documentHtml = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8" />
<title>${escapeHtml(fromName)} email signature</title>
</head>
<body style="margin:0;padding:16px;font-family:Arial,Helvetica,sans-serif;">
${signatureHtml}
</body>
</html>`;

    const blob = new Blob([documentHtml], { type: 'text/html;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    const slug = (fromName || 'signature')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');
    anchor.href = url;
    anchor.download = `${slug || 'signature'}-email-signature.htm`;
    anchor.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="min-h-svh w-full bg-[var(--ozer-cream-50)] text-[var(--ozer-plum-900)]">
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-4 py-8 sm:px-6 lg:px-8">
        <header className="flex flex-wrap items-start justify-between gap-4">
          <div className="space-y-1">
            <p className="text-xs font-medium tracking-wide text-[var(--ozer-text-muted)] uppercase">
              {isPersonalShare ? 'Your signature' : 'Signature preview'}
            </p>
            <h1 className="font-[family-name:var(--ozer-font-display)] text-3xl font-bold tracking-tight">
              {isPersonalShare ? fromName : templateName}
            </h1>
            <p className="max-w-xl text-sm text-[var(--ozer-text-muted)]">
              {isPersonalShare
                ? accountName
                  ? `${accountName} · preview, download, and install in Outlook`
                  : 'Preview, download, and install in Outlook'
                : accountName
                  ? `${accountName} · mock email with this signature applied`
                  : 'Mock email with this signature applied'}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              size="sm"
              className="bg-[var(--ozer-accent)] text-[var(--ozer-white)] hover:bg-[var(--ozer-accent-hover)]"
              onClick={downloadSignature}
              data-test="signature-download-html"
            >
              <Download className="mr-1.5 h-3.5 w-3.5" />
              Download signature HTML
            </Button>
            <div className="inline-flex rounded-lg border border-[color:var(--ozer-border-on-light)] bg-white p-0.5">
              <Button
                type="button"
                size="sm"
                variant="ghost"
                className={cn(
                  'h-8 gap-1.5 px-2.5 text-[var(--ozer-plum-900)]',
                  theme === 'light' && 'bg-[var(--ozer-cream-100)]',
                )}
                onClick={() => setTheme('light')}
                aria-pressed={theme === 'light'}
              >
                <Sun className="h-3.5 w-3.5" />
                Light
              </Button>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                className={cn(
                  'h-8 gap-1.5 px-2.5 text-[var(--ozer-plum-900)]',
                  theme === 'dark' && 'bg-[var(--ozer-cream-100)]',
                )}
                onClick={() => setTheme('dark')}
                aria-pressed={theme === 'dark'}
              >
                <Moon className="h-3.5 w-3.5" />
                Dark
              </Button>
            </div>
          </div>
        </header>

        <SignatureInstallSteps />

        <section
          className={cn(
            'overflow-hidden rounded-2xl border shadow-[0_1px_2px_rgba(42,23,32,0.05),0_4px_14px_rgba(42,23,32,0.05)]',
            isDark
              ? 'border-[#2c2c2e] bg-[#1c1c1e] text-[#f5f5f7]'
              : 'border-[#e5e5ea] bg-white text-[#1d1d1f]',
          )}
          aria-label="Mock email"
        >
          <div
            className={cn(
              'space-y-2 border-b px-5 py-4 text-sm',
              isDark ? 'border-[#2c2c2e]' : 'border-[#e5e5ea]',
            )}
          >
            <MetaRow label="From" value={`${fromName} <${fromEmail}>`} />
            <MetaRow label="To" value="you@company.com" />
            <MetaRow label="Subject" value="Quick update on the proposal" />
          </div>

          <iframe
            title="Email body with signature"
            srcDoc={iframeSrcDoc}
            sandbox=""
            className={cn(
              'h-[520px] w-full border-0 px-1 sm:h-[560px]',
              isDark ? 'bg-[#1c1c1e]' : 'bg-white',
            )}
          />
        </section>

        <footer className="flex flex-wrap items-center justify-between gap-3 text-xs text-[var(--ozer-text-muted)]">
          <p>
            {isPersonalShare
              ? "Install when you're ready — this page never changes your Outlook settings for you."
              : 'This is a shareable preview — no inbox changes are made.'}
          </p>
          <a
            href="https://ozer.so"
            className="inline-flex items-center gap-1 font-medium text-[var(--ozer-plum-900)] underline-offset-4 hover:underline"
          >
            Powered by Ozer
            <ExternalLink className="h-3 w-3" />
          </a>
        </footer>
      </div>
    </div>
  );
}

function MetaRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid grid-cols-[4.5rem_minmax(0,1fr)] gap-2">
      <span className="opacity-55">{label}</span>
      <span className="min-w-0 truncate font-medium">{value}</span>
    </div>
  );
}

function escapeHtml(value: string) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}
