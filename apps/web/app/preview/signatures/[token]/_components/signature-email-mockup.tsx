'use client';

import { useEffect, useMemo, useState } from 'react';

import { ExternalLink } from 'lucide-react';

import { cn } from '@kit/ui/utils';

import {
  type SignaturePreviewTheme,
  SignaturePreviewThemeControls,
  type SignaturePreviewViewport,
  SignaturePreviewViewportControls,
  resolveSignaturePreviewViewport,
  signaturePreviewLayoutWidthPx,
  signaturePreviewViewportStyle,
} from '~/home/[account]/(signatures)/_components/signature-preview-frame';
import { buildSignaturePreviewDocument } from '~/lib/signatures/signature-preview-document';

import { SignatureInstallSteps } from './signature-install-steps';

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
  const [theme, setTheme] = useState<SignaturePreviewTheme>('light');
  const [viewport, setViewport] = useState<SignaturePreviewViewport>('desktop');
  const isDark = theme === 'dark';
  const activeViewport = resolveSignaturePreviewViewport(viewport);
  const layoutWidthPx = signaturePreviewLayoutWidthPx(viewport);

  useEffect(() => {
    if (window.matchMedia('(max-width: 480px)').matches) {
      setViewport('mobile');
    }
  }, []);

  const iframeSrcDoc = useMemo(() => {
    const bodyHtml = `<p>Hi team,</p>
  <p>
    Thanks for taking a look at the latest proposal. I&rsquo;ve attached the
    revised timeline and a short note on next steps.
  </p>
  <p>Happy to jump on a call if anything needs clarifying.</p>
  <p>Best regards,<br />${escapeHtml(fromName)}</p>
  <div style="margin-top:18px;">${signatureHtml}</div>`;

    return buildSignaturePreviewDocument({
      bodyHtml,
      theme: isDark ? 'dark' : 'light',
      layoutWidthPx,
      bodyPadding: '20px',
      transparentBackground: true,
    }).replace(
      '</head>',
      `<style>
  body {
    font-family: Arial, Helvetica, sans-serif;
    font-size: 15px;
    line-height: 1.55;
  }
  p { margin: 0 0 1em; }
</style>
</head>`,
    );
  }, [fromName, isDark, layoutWidthPx, signatureHtml]);

  const subtitle = showInstructions
    ? isPersonalShare
      ? accountName
        ? `${accountName} · preview at mobile, tablet, or desktop width, then install in Outlook`
        : 'Preview at mobile, tablet, or desktop width, then install in Outlook'
      : accountName
        ? `${accountName} · mock email with this signature applied`
        : 'Mock email with this signature applied'
    : accountName
      ? `${accountName} · mock email with this signature applied`
      : 'Mock email with this signature applied';

  const isDeviceViewport = activeViewport.id !== 'desktop';

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

          <div className="min-w-0 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <SignaturePreviewViewportControls
                viewport={viewport}
                onViewportChange={setViewport}
                appearance="inbox"
                isDark={false}
              />
              <SignaturePreviewThemeControls
                theme={theme}
                onThemeChange={setTheme}
                appearance="inbox"
                isDark={false}
              />
            </div>

            <div className="overflow-x-auto rounded-2xl">
              <section
                className={cn(
                  'mx-auto min-w-0 transition-[max-width] duration-200 ease-out',
                  isDeviceViewport &&
                    'overflow-hidden shadow-[0_12px_40px_rgba(42,23,32,0.12)]',
                  activeViewport.id === 'mobile' &&
                    'rounded-[1.75rem] border-[9px] border-[#1d1d1f]',
                  activeViewport.id === 'tablet' &&
                    'rounded-2xl border-[6px] border-[#1d1d1f]/90',
                )}
                style={signaturePreviewViewportStyle(viewport)}
                aria-label="Mock email"
              >
                <div
                  className={cn(
                    'overflow-hidden rounded-[inherit]',
                    isDark
                      ? 'border-[#2c2c2e] bg-[#1c1c1e] text-[#f5f5f7]'
                      : 'border-[#e5e5ea] bg-white text-[#1d1d1f]',
                    !isDeviceViewport &&
                      'rounded-2xl border shadow-[0_1px_2px_rgba(42,23,32,0.05),0_4px_14px_rgba(42,23,32,0.05)]',
                  )}
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
                    <p className="text-xs opacity-60">
                      {activeViewport.widthPx
                        ? `${activeViewport.widthPx}px`
                        : 'Desktop'}
                    </p>
                  </div>

                  <div
                    className={cn(
                      'space-y-2 border-b px-5 py-4 text-sm',
                      isDark ? 'border-[#2c2c2e]' : 'border-[#e5e5ea]',
                    )}
                  >
                    <MetaRow
                      label="From"
                      value={`${fromName} <${fromEmail}>`}
                    />
                    <MetaRow label="To" value="you@company.com" />
                    <MetaRow
                      label="Subject"
                      value="Quick update on the proposal"
                    />
                  </div>

                  <iframe
                    title="Email body with signature"
                    srcDoc={iframeSrcDoc}
                    sandbox=""
                    key={`${theme}-${viewport}`}
                    className={cn(
                      'h-[560px] w-full min-w-0 border-0 sm:h-[620px]',
                      isDark ? 'bg-[#1c1c1e]' : 'bg-white',
                    )}
                  />
                </div>
              </section>
            </div>

            <p className="text-xs text-[var(--ozer-plum-900)]/60">
              Previewing at {layoutWidthPx}px (
              {activeViewport.label.toLowerCase()} layout width). Responsive
              signatures switch layouts near 480px.
            </p>
          </div>
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
