'use client';

import { useTransition } from 'react';

import { Copy, Link2, RefreshCw } from 'lucide-react';

import { Button } from '@kit/ui/button';
import { Label } from '@kit/ui/label';
import { toast } from '@kit/ui/sonner';
import { Switch } from '@kit/ui/switch';

import { copyTextToClipboard } from '~/lib/clipboard';

import { panelClass } from './meal-ui';

type ShareActionResult =
  | { success: true; data: { enabled: boolean; token: string | null } }
  | { success: false; error: string };

type Props = {
  title: string;
  description: string;
  enabled: boolean;
  token: string | null;
  buildUrl: (token: string) => string;
  onToggle: (enabled: boolean) => Promise<ShareActionResult>;
  onRotate: () => Promise<ShareActionResult>;
};

export function RecipeSharePanel({
  title,
  description,
  enabled,
  token,
  buildUrl,
  onToggle,
  onRotate,
}: Props) {
  const [pending, startTransition] = useTransition();

  function handleToggle(next: boolean) {
    startTransition(async () => {
      const result = await onToggle(next);
      if (!result.success) {
        toast.error(result.error);
        return;
      }
      toast.success(next ? 'Public page enabled' : 'Public page disabled');
    });
  }

  function handleRotate() {
    startTransition(async () => {
      const result = await onRotate();
      if (!result.success) {
        toast.error(result.error);
        return;
      }
      toast.success('Public link reset');
    });
  }

  async function handleCopy() {
    if (!token) {
      toast.error('Enable the public page first');
      return;
    }

    try {
      await copyTextToClipboard(buildUrl(token));
      toast.success('Public link copied');
    } catch {
      toast.error('Could not copy link');
    }
  }

  return (
    <section className={`${panelClass} space-y-4 p-5`}>
      <div className="flex items-center gap-2">
        <Link2 className="h-4 w-4 text-[var(--ozer-accent)]" />
        <h2 className="text-sm font-semibold text-[var(--workspace-shell-text)]">
          {title}
        </h2>
      </div>
      <p className="text-sm text-[var(--workspace-shell-text-muted)]">
        {description}
      </p>
      <div className="flex items-center justify-between gap-3">
        <Label
          htmlFor="recipe-public-share"
          className="text-sm text-[var(--workspace-shell-text)]"
        >
          Enable public page
        </Label>
        <Switch
          id="recipe-public-share"
          checked={enabled}
          disabled={pending}
          onCheckedChange={handleToggle}
        />
      </div>
      {enabled && token ? (
        <div className="space-y-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="w-full border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-sidebar-accent)] text-[var(--workspace-shell-text)]"
            onClick={() => void handleCopy()}
          >
            <Copy className="mr-2 h-4 w-4" />
            Copy public link
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={pending}
            className="w-full border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-sidebar-accent)] text-[var(--workspace-shell-text)]"
            onClick={handleRotate}
          >
            <RefreshCw className="mr-2 h-4 w-4" />
            Reset link
          </Button>
        </div>
      ) : null}
    </section>
  );
}
