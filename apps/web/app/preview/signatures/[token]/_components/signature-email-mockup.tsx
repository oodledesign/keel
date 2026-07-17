'use client';

import { useMemo, useState } from 'react';

import { ExternalLink, Moon, Sun } from 'lucide-react';

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
  token,
  showInstructions = true,
}: {
  templateName: string;
  accountName: string | null;
  fromName: string;
  fromEmail: string;
  signatureHtml: string;
  isPersonalShare: boolean;
  token: string;
  /** When false, hide Outlook install steps and show only the mock email. */
  showInstructions?: boolean;
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
    padding: 20px;
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

  const subtitle = showInstructions
    ? isPersonalShare
      ? accountName
        ? `${accountName} · preview, download, and install in Outlook`
        : 'Preview, download, and install in Outlook'
      : accountName
        ? `${accountName} · mock email with this signature applied`
        : 'Mock email with this signature applied'
    : accountName
      ? `${accountName} · mock email with this signature applied`
      : 'Mock email with this signature applied';

  return (
    <div className="min-h-svh w-full bg-[var(--ozer-cream-50)] text-[var(--ozer-plum-900)]">
      <div
        className={cn(
          'mx-auto flex w-full flex-col gap-6 px-4 py-8 sm:px-6 lg:px-8',
          showInstructions ? 'max-w-6xl' : 'max-w-3xl',
        )}
      >
        <header className="space-y-1">
          <p className="text-xs font-medium tracking-wide text-[color-mix(in_srgb,var(--ozer-plum-900)_50%,transparent)] uppercase">
            {showInstructions && isPersonalShare
              ? 'Your signature'
              : 'Signature preview'}
          </p>
          <h1 className="font-[family-name:var(--ozer-font-display)] text-3xl font-bold tracking-tight">
            {isPersonalShare ? fromName : templateName}
          </h1>
          <p className="max-w-2xl text-sm text-[var(--ozer-plum-900)]/70">
            {subtitle}
          </p>
        </header>

        <div
          className={cn(
            'grid items-start gap-6',
            showInstructions &&
              'lg:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)]',
          )}
        >
          {showInstructions ? (
            <SignatureInstallSteps
              signatureHtml={signatureHtml}
              fromName={fromName}
              token={token}
              canRequestChanges={isPersonalShare}
            />
          ) : null}

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
                'flex flex-wrap items-center justify-between gap-3 border-b px-5 py-3',
                isDark ? 'border-[#2c2c2e]' : 'border-[#e5e5ea]',
              )}
            >
              <p className="text-xs font-medium tracking-wide uppercase opacity-60">
                Email preview
              </p>
              <div
                className={cn(
                  'inline-flex rounded-lg border p-0.5',
                  isDark
                    ? 'border-[#3a3a3c] bg-[#2c2c2e]'
                    : 'border-[#e5e5ea] bg-[#f5f5f7]',
                )}
              >
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  className={cn(
                    'h-8 gap-1.5 px-2.5',
                    isDark ? 'text-[#f5f5f7]' : 'text-[#1d1d1f]',
                    theme === 'light' && (isDark ? 'bg-[#3a3a3c]' : 'bg-white'),
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
                    'h-8 gap-1.5 px-2.5',
                    isDark ? 'text-[#f5f5f7]' : 'text-[#1d1d1f]',
                    theme === 'dark' && (isDark ? 'bg-[#3a3a3c]' : 'bg-white'),
                  )}
                  onClick={() => setTheme('dark')}
                  aria-pressed={theme === 'dark'}
                >
                  <Moon className="h-3.5 w-3.5" />
                  Dark
                </Button>
              </div>
            </div>

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
                'h-[560px] w-full border-0 sm:h-[620px]',
                isDark ? 'bg-[#1c1c1e]' : 'bg-white',
              )}
            />
          </section>
        </div>

        <footer className="flex flex-wrap items-center justify-between gap-3 text-xs text-[var(--ozer-plum-900)]/60">
          <p>
            {showInstructions && isPersonalShare
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
