'use client';

import { useCallback, useEffect, useState, useTransition } from 'react';

import { Globe } from 'lucide-react';

import { Checkbox } from '@kit/ui/checkbox';
import { Label } from '@kit/ui/label';
import { RadioGroup, RadioGroupItem } from '@kit/ui/radio-group';
import { toast } from '@kit/ui/sonner';
import { Switch } from '@kit/ui/switch';

import { formatContactRoleLabel } from '~/lib/clients/contact-roles';

import {
  type ProjectPortalAccess,
  summarizeProjectPortalAccess,
} from '../_lib/schema/project-portal-access.schema';
import {
  getProjectPortalAccess,
  setProjectPortalAccess,
} from '../_lib/server/server-actions';

type AccessMode = 'all' | 'restricted';

export function ProjectPortalAccessPanel(props: {
  accountId: string;
  accountSlug: string;
  jobId: string;
  hasClient: boolean;
  canManage: boolean;
  initialPortalVisible?: boolean;
  onSummaryChange?: (summary: string, isVisible: boolean) => void;
}) {
  const [access, setAccess] = useState<ProjectPortalAccess | null>(null);
  const [loading, setLoading] = useState(true);
  const [pending, startTransition] = useTransition();

  const onSummaryChange = props.onSummaryChange;

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const next = await getProjectPortalAccess({
        accountId: props.accountId,
        jobId: props.jobId,
      });
      setAccess(next);
      onSummaryChange?.(summarizeProjectPortalAccess(next), next.portalVisible);
      return next;
    } finally {
      setLoading(false);
    }
  }, [props.accountId, props.jobId, onSummaryChange]);

  useEffect(() => {
    void refresh().catch((err) => {
      toast.error(
        err instanceof Error ? err.message : 'Could not load portal access',
      );
    });
  }, [refresh]);

  const disabled = !props.canManage || !props.hasClient || pending || loading;
  const portalVisible = Boolean(
    access?.portalVisible ?? props.initialPortalVisible,
  );
  const mode: AccessMode = access?.restrictContacts ? 'restricted' : 'all';
  const selected = new Set(access?.contactIds ?? []);

  function apply(patch: {
    portalVisible?: boolean;
    restrictContacts?: boolean;
    contactIds?: string[];
  }) {
    const previous = access;
    if (previous) {
      setAccess({
        ...previous,
        portalVisible: patch.portalVisible ?? previous.portalVisible,
        restrictContacts: patch.restrictContacts ?? previous.restrictContacts,
        contactIds: patch.contactIds ?? previous.contactIds,
      });
    }

    startTransition(async () => {
      try {
        const next = await setProjectPortalAccess({
          accountId: props.accountId,
          accountSlug: props.accountSlug,
          jobId: props.jobId,
          ...patch,
        });
        setAccess(next);
        props.onSummaryChange?.(
          summarizeProjectPortalAccess(next),
          next.portalVisible,
        );
        if (patch.portalVisible !== undefined) {
          toast.success(
            patch.portalVisible
              ? 'Project shared to portal'
              : 'Project hidden from portal',
          );
        } else if (patch.restrictContacts === false) {
          toast.success('All portal contacts can see this project');
        } else if (patch.restrictContacts === true) {
          toast.success('Portal access limited to selected contacts');
        } else {
          toast.success('Portal contacts updated');
        }
      } catch (err) {
        setAccess(previous);
        toast.error(
          err instanceof Error ? err.message : 'Could not update portal access',
        );
      }
    });
  }

  return (
    <div className="space-y-4 rounded-xl border border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-panel)]/40 p-4">
      <div className="flex items-start justify-between gap-4">
        <div className="flex gap-3">
          <Globe className="mt-0.5 h-4 w-4 shrink-0 text-[var(--workspace-shell-text-muted)]" />
          <div>
            <Label className="text-sm font-medium text-[var(--workspace-shell-text)]">
              Client portal access
            </Label>
            <p className="mt-0.5 text-xs text-[var(--workspace-shell-text-muted)]">
              {props.hasClient
                ? 'Share this project to the client portal, then choose whether every portal contact can see it or only a specific list.'
                : 'Link a client to this project to enable portal access.'}
            </p>
          </div>
        </div>
        <Switch
          checked={portalVisible}
          disabled={disabled}
          onCheckedChange={(checked) => apply({ portalVisible: checked })}
          aria-label="Share project to client portal"
          data-test="project-portal-visible-switch"
        />
      </div>

      {portalVisible && props.hasClient ? (
        <div className="space-y-3 border-t border-[color:var(--workspace-shell-border)] pt-3">
          <RadioGroup
            value={mode}
            disabled={disabled}
            onValueChange={(value) =>
              apply({ restrictContacts: value === 'restricted' })
            }
            className="gap-2"
          >
            <label className="flex cursor-pointer items-start gap-2.5 text-sm text-[var(--workspace-shell-text)]">
              <RadioGroupItem value="all" className="mt-0.5" />
              <span>
                All portal contacts
                <span className="mt-0.5 block text-xs text-[var(--workspace-shell-text-muted)]">
                  Everyone invited to this client’s portal can open the project.
                </span>
              </span>
            </label>
            <label className="flex cursor-pointer items-start gap-2.5 text-sm text-[var(--workspace-shell-text)]">
              <RadioGroupItem value="restricted" className="mt-0.5" />
              <span>
                Specific contacts only
                <span className="mt-0.5 block text-xs text-[var(--workspace-shell-text-muted)]">
                  Only the people you tick below can see this project.
                </span>
              </span>
            </label>
          </RadioGroup>

          {mode === 'restricted' ? (
            <div className="space-y-2">
              {loading ? (
                <p className="text-xs text-[var(--workspace-shell-text-muted)]">
                  Loading contacts…
                </p>
              ) : (access?.contacts.length ?? 0) === 0 ? (
                <p className="text-xs text-[var(--workspace-shell-text-muted)]">
                  Add contacts on the client record, then invite them to the
                  portal.
                </p>
              ) : (
                <ul className="max-h-64 space-y-1 overflow-auto rounded-lg border border-[color:var(--workspace-shell-border)] bg-[var(--workspace-control-surface)]/40 p-2">
                  {access?.contacts.map((contact) => {
                    const checked = selected.has(contact.id);
                    return (
                      <li key={contact.id}>
                        <label className="flex cursor-pointer items-start gap-2.5 rounded-md px-2 py-1.5 text-sm hover:bg-[var(--workspace-shell-sidebar-accent)]">
                          <Checkbox
                            checked={checked}
                            disabled={disabled}
                            data-test={`portal-contact-checkbox-${contact.id}`}
                            onCheckedChange={(value) => {
                              const next = new Set(selected);
                              if (value === true) next.add(contact.id);
                              else next.delete(contact.id);
                              apply({ contactIds: [...next] });
                            }}
                            className="mt-0.5"
                          />
                          <span className="min-w-0">
                            <span className="block truncate font-medium text-[var(--workspace-shell-text)]">
                              {contact.fullName}
                              {contact.isPrimary ? (
                                <span className="ml-1.5 text-[11px] font-normal text-[var(--workspace-shell-text-muted)]">
                                  Primary
                                </span>
                              ) : null}
                            </span>
                            <span className="block truncate text-xs text-[var(--workspace-shell-text-muted)]">
                              {[
                                contact.email,
                                contact.role
                                  ? formatContactRoleLabel(contact.role)
                                  : null,
                              ]
                                .filter(Boolean)
                                .join(' · ') || 'No email'}
                            </span>
                          </span>
                        </label>
                      </li>
                    );
                  })}
                </ul>
              )}
              {mode === 'restricted' && selected.size === 0 ? (
                <p className="text-xs text-amber-600 dark:text-amber-400">
                  No contacts selected — nobody on the client portal can see
                  this project.
                </p>
              ) : null}
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
