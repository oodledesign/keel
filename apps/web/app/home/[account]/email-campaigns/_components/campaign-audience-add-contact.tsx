'use client';

import { useMemo, useState, useTransition } from 'react';

import { useRouter } from 'next/navigation';

import { Button } from '@kit/ui/button';
import { Input } from '@kit/ui/input';
import { Label } from '@kit/ui/label';
import { toast } from '@kit/ui/sonner';

import { parseAudienceEmailInput } from '~/lib/campaigns/campaign-audience';
import { workspaceText, workspaceTextMuted } from '~/lib/workspace-ui';

import {
  addAudienceListMembersAction,
  saveCampaignContactAction,
} from '../_lib/server/server-actions';
import type { AudiencePickerOption } from './campaign-audience-picker';

export function CampaignAudienceAddContact({
  accountId,
  accountSlug,
  mode,
  listId,
  listName,
  contacts,
  selectedIds,
  disabled,
  onAddToAudience,
  onContactCreated,
}: {
  accountId?: string;
  accountSlug: string;
  mode: 'custom' | 'manual-list';
  listId?: string;
  listName?: string;
  contacts: AudiencePickerOption[];
  selectedIds?: ReadonlySet<string>;
  disabled?: boolean;
  onAddToAudience?: (contactId: string) => void;
  onContactCreated: (contact: AudiencePickerOption) => void;
}) {
  const router = useRouter();
  const [query, setQuery] = useState('');
  const [pending, startTransition] = useTransition();
  const busy = disabled || pending;

  const normalized = query.trim().toLowerCase();
  const createEmail = useMemo(() => {
    const parsed = parseAudienceEmailInput(query);
    return parsed.length === 1 ? parsed[0] : null;
  }, [query]);
  const emailTaken = Boolean(
    createEmail &&
    contacts.some((row) => row.email.toLowerCase() === createEmail),
  );

  const matches = useMemo(() => {
    if (!normalized) return [];
    return contacts
      .filter(
        (row) =>
          row.email.toLowerCase().includes(normalized) ||
          row.displayName.toLowerCase().includes(normalized),
      )
      .slice(0, 8);
  }, [contacts, normalized]);

  const showCreate = Boolean(accountId && createEmail && !emailTaken);

  const addExisting = (contact: AudiencePickerOption) => {
    if (mode === 'custom') {
      if (selectedIds?.has(contact.id) || !onAddToAudience) return;
      onAddToAudience(contact.id);
      toast.success('Added to audience');
      setQuery('');
      return;
    }

    if (!accountId || !listId) {
      toast.error('Could not add that contact');
      return;
    }
    startTransition(async () => {
      try {
        const result = await addAudienceListMembersAction({
          accountId,
          accountSlug,
          listId,
          contactIds: [contact.id],
        });
        if (!result.added) {
          toast.error('Could not add that contact');
          return;
        }
        toast.success(listName ? `Added to ${listName}` : 'Added to list');
        setQuery('');
        router.refresh();
      } catch (error) {
        toast.error(
          error instanceof Error ? error.message : 'Could not add that contact',
        );
      }
    });
  };

  const createAndAdd = () => {
    if (!accountId || !createEmail) return;
    startTransition(async () => {
      try {
        const saved = await saveCampaignContactAction({
          accountId,
          accountSlug,
          email: createEmail,
        });
        const created: AudiencePickerOption = {
          id: saved.contactId,
          email: createEmail,
          displayName: createEmail,
        };
        onContactCreated(created);

        if (mode === 'custom') {
          onAddToAudience?.(saved.contactId);
          toast.success('Contact created and added to the audience');
          setQuery('');
          router.refresh();
          return;
        }

        if (!listId) {
          toast.error('Contact created, but could not add them to the list');
          router.refresh();
          return;
        }
        const result = await addAudienceListMembersAction({
          accountId,
          accountSlug,
          listId,
          contactIds: [saved.contactId],
        });
        if (!result.added) {
          toast.error('Contact created, but could not add them to the list');
          router.refresh();
          return;
        }
        toast.success(
          listName
            ? `Contact created and added to ${listName}`
            : 'Contact created and added to the list',
        );
        setQuery('');
        router.refresh();
      } catch (error) {
        toast.error(
          error instanceof Error ? error.message : 'Could not create contact',
        );
      }
    });
  };

  return (
    <div className="space-y-2" data-test="campaign-audience-add-contact">
      <Label className={workspaceText}>Add one contact</Label>
      <Input
        value={query}
        disabled={busy}
        placeholder="Search name or email…"
        data-test="campaign-audience-add-contact-search"
        onChange={(event) => setQuery(event.target.value)}
      />
      {normalized ? (
        <ul className="max-h-48 space-y-2 overflow-y-auto rounded-md border border-[color:var(--workspace-shell-border)] p-2">
          {matches.map((row) => {
            const already =
              mode === 'custom' && Boolean(selectedIds?.has(row.id));
            return (
              <li
                key={row.id}
                className="flex items-center justify-between gap-2"
              >
                <span className="min-w-0">
                  <span
                    className={`block truncate text-sm font-medium ${workspaceText}`}
                  >
                    {row.displayName}
                  </span>
                  <span
                    className={`block truncate text-xs ${workspaceTextMuted}`}
                  >
                    {row.email}
                  </span>
                </span>
                <Button
                  type="button"
                  size="sm"
                  disabled={busy || already}
                  data-test="campaign-audience-add-contact-pick"
                  onClick={() => addExisting(row)}
                >
                  {already ? 'Added' : 'Add'}
                </Button>
              </li>
            );
          })}
          {showCreate ? (
            <li>
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={busy}
                data-test="campaign-audience-create-contact"
                onClick={createAndAdd}
              >
                Create {createEmail} and add
              </Button>
            </li>
          ) : null}
          {matches.length === 0 && !showCreate ? (
            <li className={`text-sm ${workspaceTextMuted}`}>
              No matching contacts.
            </li>
          ) : null}
        </ul>
      ) : (
        <p className={`text-xs ${workspaceTextMuted}`}>
          {mode === 'manual-list'
            ? `Search to add someone to ${listName ?? 'this list'}. They are saved on the list immediately.`
            : 'Search by name or email, then add. A new email creates the contact and adds them.'}
        </p>
      )}
    </div>
  );
}
