'use client';

import { useState, useTransition } from 'react';

import { Button } from '@kit/ui/button';
import { Checkbox } from '@kit/ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@kit/ui/dialog';
import { Input } from '@kit/ui/input';
import { Label } from '@kit/ui/label';
import { toast } from '@kit/ui/sonner';

import type { CirculationCandidate } from '~/lib/commercial/circulation/circulate-listing';

import {
  circulateListingAction,
  getCirculationIdentityAction,
  listListingCirculationCandidates,
} from '../_lib/server/circulation-actions';

type Props = {
  accountId: string;
  listingId: string;
  defaultFromEmail?: string | null;
  defaultFromName?: string | null;
};

export function ListingCirculateDialog({
  accountId,
  listingId,
  defaultFromEmail,
  defaultFromName,
}: Props) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [candidates, setCandidates] = useState<CirculationCandidate[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [fromEmail, setFromEmail] = useState(defaultFromEmail ?? '');
  const [fromName, setFromName] = useState(defaultFromName ?? '');
  const [dryRun, setDryRun] = useState(false);
  const [loading, setLoading] = useState(false);

  function loadMatches() {
    setLoading(true);
    Promise.all([
      listListingCirculationCandidates({ accountId, listingId }),
      getCirculationIdentityAction({ accountId }).catch(() => null),
    ])
      .then(([rows, identity]) => {
        setCandidates(rows);
        setSelected(
          new Set(rows.filter((r) => r.subscribed).map((r) => r.requirementId)),
        );
        if (identity) {
          setFromName((current) => current || identity.fromName || '');
          setFromEmail((current) => current || identity.fromEmail || '');
        }
      })
      .catch((err) => {
        toast.error(
          err instanceof Error ? err.message : 'Could not load matches',
        );
      })
      .finally(() => setLoading(false));
  }

  function toggle(id: string, enabled: boolean) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (enabled) next.add(id);
      else next.delete(id);
      return next;
    });
  }

  function send() {
    if (!fromEmail.trim()) {
      toast.error(
        'Set a From email on a verified SES domain (or save a contact email in Brand settings)',
      );
      return;
    }
    startTransition(async () => {
      try {
        const result = await circulateListingAction({
          accountId,
          listingId,
          requirementIds: [...selected],
          fromEmail: fromEmail.trim(),
          fromName: fromName.trim() || undefined,
          replyTo: fromEmail.trim(),
          dryRun,
        });
        toast.success(
          dryRun
            ? `Dry run: ${result.dryRunEligible} would be mailed (nothing sent)`
            : `Circulation sent: ${result.sent} delivered, ${result.skipped} skipped, ${result.failed} failed`,
        );
        setOpen(false);
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'Circulation failed');
      }
    });
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (next) loadMatches();
      }}
    >
      <DialogTrigger asChild>
        <Button
          type="button"
          size="sm"
          variant="outline"
          data-test="circulation-open-button"
        >
          Circulate
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[85vh] max-w-lg overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Send to matching requirements</DialogTitle>
        </DialogHeader>

        <p className="text-sm text-[var(--workspace-shell-text-muted)]">
          Sends via Amazon SES as this workspace — logo, colours, and From name
          come from Brand settings. Recipients who unsubscribed are blocked.
        </p>

        <div className="grid gap-3 sm:grid-cols-2">
          <div className="grid gap-1.5">
            <Label>From name</Label>
            <Input
              value={fromName}
              onChange={(e) => setFromName(e.target.value)}
              placeholder="Agency name"
            />
          </div>
          <div className="grid gap-1.5">
            <Label>From email (SES verified)</Label>
            <Input
              type="email"
              value={fromEmail}
              onChange={(e) => setFromEmail(e.target.value)}
              placeholder="lettings@agency.co.uk"
            />
          </div>
        </div>

        <div className="max-h-64 space-y-2 overflow-y-auto rounded-md border border-[var(--workspace-shell-border)] p-2">
          {loading ? (
            <p className="p-2 text-sm text-[var(--workspace-shell-text-muted)]">
              Loading matches…
            </p>
          ) : candidates.length === 0 ? (
            <p className="p-2 text-sm text-[var(--workspace-shell-text-muted)]">
              No matching requirements with an email address.
            </p>
          ) : (
            candidates.map((c) => (
              <label
                key={c.requirementId}
                className="flex items-start gap-2 rounded-md p-2 hover:bg-[var(--workspace-shell-sidebar-accent)]"
              >
                <Checkbox
                  checked={selected.has(c.requirementId)}
                  disabled={c.blocked}
                  onCheckedChange={(v) => toggle(c.requirementId, Boolean(v))}
                />
                <span className="min-w-0 flex-1 text-sm">
                  <span className="font-medium text-[var(--workspace-shell-text)]">
                    {c.contactName || c.email}
                  </span>
                  {c.companyName ? (
                    <span className="text-[var(--workspace-shell-text-muted)]">
                      {' '}
                      · {c.companyName}
                    </span>
                  ) : null}
                  <span className="mt-0.5 block text-xs text-[var(--workspace-shell-text-muted)]">
                    {c.email} · score {c.score}
                    {c.blocked
                      ? ` · ${c.consentStatus}`
                      : c.subscribed
                        ? ' · subscribed'
                        : ' · no preference on file'}
                  </span>
                </span>
              </label>
            ))
          )}
        </div>

        <label className="flex items-center gap-2 text-sm text-[var(--workspace-shell-text)]">
          <Checkbox
            checked={dryRun}
            onCheckedChange={(v) => setDryRun(Boolean(v))}
            data-test="circulation-dry-run-checkbox"
          />
          Dry run — log recipients without calling SES
        </label>

        <DialogFooter>
          <Button
            type="button"
            disabled={pending || selected.size === 0}
            data-test="circulation-send-button"
            onClick={send}
          >
            {pending
              ? dryRun
                ? 'Logging…'
                : 'Sending…'
              : dryRun
                ? `Dry-run ${selected.size}`
                : `Send to ${selected.size}`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
