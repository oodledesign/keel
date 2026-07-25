'use client';

import { useEffect, useState, useTransition } from 'react';

import { Building2, Link2Off, Loader2 } from 'lucide-react';

import { Button } from '@kit/ui/button';
import { Input } from '@kit/ui/input';
import { toast } from '@kit/ui/sonner';

import {
  getClientWorkspaceLinkAction,
  linkClientWorkspaceAction,
  unlinkClientWorkspaceAction,
} from '../_lib/server/client-support-link-actions';

type LinkState = {
  linked: boolean;
  accountId: string | null;
  slug: string | null;
  name: string | null;
};

export function ClientWorkspaceLinkCard({
  accountId,
  clientOrgId,
  accountSlug,
  compact = false,
}: {
  accountId: string;
  clientOrgId: string;
  accountSlug: string;
  compact?: boolean;
}) {
  const [state, setState] = useState<LinkState | null>(null);
  const [slugInput, setSlugInput] = useState('');
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    startTransition(async () => {
      try {
        const result = await getClientWorkspaceLinkAction({
          accountId,
          clientOrgId,
        });
        setState(result);
      } catch {
        setState({
          linked: false,
          accountId: null,
          slug: null,
          name: null,
        });
      }
    });
  }, [accountId, clientOrgId]);

  function link() {
    startTransition(async () => {
      try {
        const result = await linkClientWorkspaceAction({
          accountId,
          clientOrgId,
          accountSlug,
          workspaceSlug: slugInput,
        });
        setState(result);
        setSlugInput('');
        toast.success('Workspace linked');
      } catch (error) {
        toast.error(
          error instanceof Error ? error.message : 'Could not link workspace',
        );
      }
    });
  }

  function unlink() {
    startTransition(async () => {
      try {
        await unlinkClientWorkspaceAction({
          accountId,
          clientOrgId,
          accountSlug,
        });
        setState({
          linked: false,
          accountId: null,
          slug: null,
          name: null,
        });
        toast.success('Workspace unlinked');
      } catch (error) {
        toast.error(
          error instanceof Error ? error.message : 'Could not unlink workspace',
        );
      }
    });
  }

  return (
    <div
      className={
        compact
          ? 'rounded-xl border border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-panel)] p-4'
          : 'rounded-xl border border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-sidebar-accent)] p-4'
      }
    >
      <div className="flex items-start gap-3">
        <div className="flex h-9 w-9 items-center justify-center rounded-full bg-[var(--ozer-accent-subtle)] text-[var(--ozer-accent)]">
          <Building2 className="h-4 w-4" />
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="text-sm font-semibold text-[var(--workspace-shell-text)]">
            Linked Ozer workspace
          </h3>
          <p className="mt-1 text-xs text-[var(--workspace-shell-text-muted)]">
            Members of that workspace can raise Partner Support tickets that
            land in your Support queue.
          </p>

          {pending && !state ? (
            <p className="mt-2 text-xs text-[var(--workspace-shell-text-muted)]">
              Loading…
            </p>
          ) : state?.linked ? (
            <div className="mt-3 space-y-2">
              <p className="text-sm text-[var(--workspace-shell-text)]">
                {state.name ?? state.slug}
                {state.slug ? (
                  <span className="text-[var(--workspace-shell-text-muted)]">
                    {' '}
                    ({state.slug})
                  </span>
                ) : null}
              </p>
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={pending}
                onClick={unlink}
              >
                {pending ? (
                  <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Link2Off className="mr-2 h-3.5 w-3.5" />
                )}
                Unlink
              </Button>
            </div>
          ) : (
            <div className="mt-3 flex flex-col gap-2 sm:flex-row">
              <Input
                value={slugInput}
                onChange={(event) => setSlugInput(event.target.value)}
                placeholder="workspace-slug"
                className="sm:max-w-[220px]"
              />
              <Button
                type="button"
                size="sm"
                disabled={pending || !slugInput.trim()}
                onClick={link}
              >
                {pending ? (
                  <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
                ) : null}
                Link workspace
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
