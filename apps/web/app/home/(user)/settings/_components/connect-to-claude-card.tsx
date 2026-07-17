'use client';

import { useState } from 'react';

import { Bot, Check, Copy } from 'lucide-react';

import { Badge } from '@kit/ui/badge';
import { Button } from '@kit/ui/button';
import { toast } from '@kit/ui/sonner';

type Props = {
  connectorUrl: string;
};

export function ConnectToClaudeCard({ connectorUrl }: Props) {
  const [copied, setCopied] = useState(false);

  const steps = [
    'In Claude: Settings → Connectors → Add custom connector',
    `Paste the connector URL: ${connectorUrl}`,
    'Click Connect, then approve access on the Ozer consent screen',
  ];

  async function copyUrl() {
    try {
      await navigator.clipboard.writeText(connectorUrl);
      setCopied(true);
      toast.success('Connector URL copied');
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error('Could not copy to clipboard');
    }
  }

  return (
    <div className="rounded-xl border border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-sidebar-accent)] p-4">
      <div className="flex min-w-0 gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[var(--ozer-accent)]/15 text-[var(--ozer-accent)]">
          <Bot className="h-5 w-5" aria-hidden />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-sm font-semibold text-[var(--workspace-shell-text)]">
              Connect to Claude
            </h3>
            <Badge
              variant="outline"
              className="rounded-full border-[color:var(--workspace-shell-border)] px-2.5 py-0.5 text-[10px] font-medium tracking-wide text-[var(--workspace-shell-text-muted)] uppercase"
            >
              MCP
            </Badge>
          </div>
          <p className="mt-1 text-sm text-[var(--workspace-shell-text-muted)]">
            Link Claude to your Ozer tasks so you can create, list and update
            them from chat. Disconnect any time from Claude&apos;s connector
            settings.
          </p>

          <div className="mt-4">
            <p className="mb-2 text-xs font-medium tracking-wide text-[var(--workspace-shell-text-muted)] uppercase">
              Connector URL
            </p>
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
              <code className="min-w-0 flex-1 truncate rounded-lg border border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-panel)] px-3 py-2 text-xs text-[var(--workspace-shell-text)]">
                {connectorUrl}
              </code>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="shrink-0"
                onClick={() => void copyUrl()}
              >
                {copied ? (
                  <Check className="mr-2 h-4 w-4" aria-hidden />
                ) : (
                  <Copy className="mr-2 h-4 w-4" aria-hidden />
                )}
                {copied ? 'Copied' : 'Copy'}
              </Button>
            </div>
          </div>

          <ol className="mt-4 list-decimal space-y-2 pl-5 text-sm text-[var(--workspace-shell-text-muted)]">
            {steps.map((step) => (
              <li key={step}>{step}</li>
            ))}
          </ol>

          <p className="mt-4 text-xs text-[var(--workspace-shell-text-muted)]">
            Requires a Claude Pro, Max, Team or Enterprise plan, or Claude Free
            with one custom connector slot.
          </p>
        </div>
      </div>
    </div>
  );
}
