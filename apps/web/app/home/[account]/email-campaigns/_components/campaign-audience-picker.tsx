'use client';

import { useEffect, useMemo, useRef, useState } from 'react';

import Link from 'next/link';

import { Checkbox } from '@kit/ui/checkbox';
import { Input } from '@kit/ui/input';
import { Label } from '@kit/ui/label';
import { RadioGroup, RadioGroupItem } from '@kit/ui/radio-group';
import { Textarea } from '@kit/ui/textarea';

import pathsConfig from '~/config/paths.config';
import {
  hasCampaignsGrowthFeatures,
  hasCampaignsSavedLists,
} from '~/lib/billing/campaign-pricing';
import {
  AUDIENCE_TYPE_HINT,
  AUDIENCE_TYPE_LABEL,
  type CampaignAudienceConfig,
  type CampaignAudienceType,
  campaignAudienceListMissing,
  parseAudienceEmailInput,
} from '~/lib/campaigns/campaign-audience';
import type { CampaignAudienceList } from '~/lib/campaigns/campaign.types';
import {
  workspacePanelCard,
  workspaceText,
  workspaceTextMuted,
} from '~/lib/workspace-ui';

import { CampaignAudienceAddContact } from './campaign-audience-add-contact';

export type AudiencePickerOption = {
  id: string;
  email: string;
  displayName: string;
};

export function CampaignAudiencePicker({
  accountId,
  accountSlug,
  audienceType,
  audienceConfig,
  estimatedCount,
  counts,
  clients,
  contacts,
  lists = [],
  planTier,
  disabled,
  lockType,
  embedded,
  onChange,
}: {
  accountId?: string;
  accountSlug: string;
  audienceType: CampaignAudienceType;
  audienceConfig: CampaignAudienceConfig;
  estimatedCount: number;
  counts: {
    subscriberCount: number;
    clientCount: number;
    contactCount: number;
  };
  clients: AudiencePickerOption[];
  contacts: AudiencePickerOption[];
  lists?: CampaignAudienceList[];
  planTier?: string;
  disabled?: boolean;
  /** Hide the type radios and show only this audience's fields. */
  lockType?: 'custom';
  /** Drop the card chrome so the fields can sit inside a dialog. */
  embedded?: boolean;
  onChange: (next: {
    audienceType: CampaignAudienceType;
    audienceConfig: CampaignAudienceConfig;
  }) => void;
}) {
  const effectiveType = lockType ?? audienceType;
  const growth = hasCampaignsGrowthFeatures(planTier);
  const savedLists = hasCampaignsSavedLists(planTier);
  const newListHref = pathsConfig.app.accountEmailCampaignAudienceNew.replace(
    '[account]',
    accountSlug,
  );
  const listMissing = campaignAudienceListMissing(audienceType, audienceConfig);
  const showListRadio =
    savedLists && (lists.length > 0 || audienceType === 'list');
  const [manualText, setManualText] = useState(
    (audienceConfig.emails ?? []).join(', '),
  );
  const [createdContacts, setCreatedContacts] = useState<
    AudiencePickerOption[]
  >([]);

  const contactOptions = useMemo(() => {
    const known = new Set(contacts.map((row) => row.id));
    const extras = createdContacts.filter((row) => !known.has(row.id));
    return [...extras, ...contacts];
  }, [contacts, createdContacts]);

  const selectedClientIds = useMemo(
    () => new Set(audienceConfig.clientIds ?? []),
    [audienceConfig.clientIds],
  );
  const selectedContactIds = useMemo(
    () => new Set(audienceConfig.contactIds ?? []),
    [audienceConfig.contactIds],
  );
  const selectedList = lists.find((list) => list.id === audienceConfig.listId);
  const audienceConfigRef = useRef(audienceConfig);
  useEffect(() => {
    audienceConfigRef.current = audienceConfig;
  }, [audienceConfig]);

  const addContactToCustomAudience = (contactId: string) => {
    const current = audienceConfigRef.current;
    const next = new Set(current.contactIds ?? []);
    next.add(contactId);
    const nextConfig = {
      ...current,
      contactIds: [...next],
    };
    audienceConfigRef.current = nextConfig;
    onChange({
      audienceType: 'custom',
      audienceConfig: nextConfig,
    });
  };

  const setType = (next: CampaignAudienceType) => {
    onChange({
      audienceType: next,
      audienceConfig:
        next === 'custom'
          ? audienceConfig
          : { emails: [], clientIds: [], contactIds: [], listId: null },
    });
  };

  return (
    <div
      className={embedded ? 'space-y-4' : `${workspacePanelCard} space-y-4 p-4`}
      data-test="campaign-audience-picker"
    >
      {embedded ? null : (
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <h2 className={`font-semibold ${workspaceText}`}>Audience</h2>
            <p className={`mt-1 text-sm ${workspaceTextMuted}`}>
              Choose who receives this campaign. Unsubscribed and suppressed
              addresses are never sent.
            </p>
          </div>
          <p
            className={`text-sm font-medium ${workspaceText}`}
            data-test="campaign-audience-estimate"
          >
            ~{estimatedCount.toLocaleString()} recipients
          </p>
        </div>
      )}

      {lockType ? null : (
        <RadioGroup
          value={audienceType}
          disabled={disabled}
          onValueChange={(value) => setType(value as CampaignAudienceType)}
          className="grid gap-3 sm:grid-cols-2"
        >
          {(
            [
              ['subscribers', counts.subscriberCount],
              ['clients', counts.clientCount],
              ['contacts', counts.contactCount],
              ['custom', null],
              ...(showListRadio
                ? ([['list', lists.length]] as Array<
                    [CampaignAudienceType, number | null]
                  >)
                : []),
            ] as Array<[CampaignAudienceType, number | null]>
          ).map(([type, count]) => (
            <label
              key={type}
              className="flex cursor-pointer items-start gap-3 rounded-md border border-[color:var(--workspace-shell-border)] p-3"
            >
              <RadioGroupItem value={type} id={`audience-${type}`} />
              <span className="min-w-0">
                <span className={`block font-medium ${workspaceText}`}>
                  {AUDIENCE_TYPE_LABEL[type]}
                  {count != null ? (
                    <span
                      className={`ml-2 text-xs font-normal ${workspaceTextMuted}`}
                    >
                      ({count.toLocaleString()})
                    </span>
                  ) : null}
                </span>
                <span className={`mt-0.5 block text-xs ${workspaceTextMuted}`}>
                  {AUDIENCE_TYPE_HINT[type]}
                </span>
              </span>
            </label>
          ))}
        </RadioGroup>
      )}

      {!lockType &&
      (effectiveType === 'subscribers' ||
        effectiveType === 'clients' ||
        effectiveType === 'contacts') ? (
        <p
          className={`text-sm ${workspaceTextMuted}`}
          data-test="campaign-audience-add-one-hint"
        >
          Add one contact from Custom, or from a manual saved list.
        </p>
      ) : null}

      {!lockType &&
      savedLists &&
      lists.length === 0 &&
      effectiveType !== 'list' ? (
        <div
          className="space-y-1 rounded-md border border-[color:var(--workspace-shell-border)] p-3"
          data-test="campaign-audience-create-list-prompt"
        >
          <p className={`text-sm font-medium ${workspaceText}`}>Saved list</p>
          <p className={`text-sm ${workspaceTextMuted}`}>
            No saved lists yet.{' '}
            <Link
              href={newListHref}
              className="text-[var(--ozer-accent)] underline-offset-2 hover:underline"
              data-test="campaign-create-audience-list-prompt"
            >
              Create a list
            </Link>{' '}
            to target one.
          </p>
        </div>
      ) : null}

      {effectiveType === 'list' && savedLists ? (
        <div className="space-y-2 border-t border-[color:var(--workspace-shell-border)] pt-4">
          <Label className={workspaceText}>Saved list</Label>
          {lists.length === 0 ? (
            <p
              className={`text-sm ${workspaceTextMuted}`}
              data-test="campaign-audience-empty-lists"
            >
              No saved lists yet.{' '}
              <Link
                href={newListHref}
                className="text-[var(--ozer-accent)] underline-offset-2 hover:underline"
                data-test="campaign-create-audience-list-picker"
              >
                Create a list
              </Link>{' '}
              before sending.
            </p>
          ) : (
            <select
              className="border-input bg-background h-9 w-full rounded-md border px-3 text-sm"
              value={audienceConfig.listId ?? ''}
              disabled={disabled}
              onChange={(event) =>
                onChange({
                  audienceType: 'list',
                  audienceConfig: {
                    ...audienceConfig,
                    listId: event.target.value || null,
                  },
                })
              }
            >
              <option value="">Choose a list…</option>
              {lists.map((list) => (
                <option key={list.id} value={list.id}>
                  {list.name}
                </option>
              ))}
            </select>
          )}
          {listMissing && lists.length > 0 ? (
            <p
              className={`text-sm ${workspaceTextMuted}`}
              data-test="campaign-audience-pick-list"
            >
              Pick a list (or create one) before sending.
            </p>
          ) : null}
          {selectedList?.source === 'manual' ? (
            <CampaignAudienceAddContact
              accountId={accountId}
              accountSlug={accountSlug}
              mode="manual-list"
              listId={selectedList.id}
              listName={selectedList.name}
              contacts={contactOptions}
              disabled={disabled}
              onContactCreated={(contact) =>
                setCreatedContacts((current) => [contact, ...current])
              }
            />
          ) : selectedList ? (
            <p
              className={`text-sm ${workspaceTextMuted}`}
              data-test="campaign-audience-logic-list-note"
            >
              This list includes people by filter rules. Add one contact from a
              manual list, or from Custom.
            </p>
          ) : null}
        </div>
      ) : null}

      {effectiveType === 'custom' ? (
        <div
          className={
            lockType
              ? 'space-y-4'
              : 'space-y-4 border-t border-[color:var(--workspace-shell-border)] pt-4'
          }
        >
          <CampaignAudienceAddContact
            accountId={accountId}
            accountSlug={accountSlug}
            mode="custom"
            contacts={contactOptions}
            selectedIds={selectedContactIds}
            disabled={disabled}
            onAddToAudience={addContactToCustomAudience}
            onContactCreated={(contact) =>
              setCreatedContacts((current) => [contact, ...current])
            }
          />

          <div className="space-y-2">
            <Label htmlFor="campaign-audience-emails" className={workspaceText}>
              Manual emails
            </Label>
            <Textarea
              id="campaign-audience-emails"
              data-test="campaign-audience-manual-emails"
              placeholder="alex@example.com, jordan@client.com"
              value={manualText}
              disabled={disabled}
              rows={3}
              onChange={(event) => {
                const value = event.target.value;
                setManualText(value);
                onChange({
                  audienceType: 'custom',
                  audienceConfig: {
                    ...audienceConfig,
                    emails: parseAudienceEmailInput(value),
                  },
                });
              }}
            />
            <p className={`text-xs ${workspaceTextMuted}`}>
              Separate with commas or spaces.
            </p>
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <PickerList
              title="Clients"
              empty="No clients with email."
              options={clients}
              selected={selectedClientIds}
              disabled={disabled}
              onToggle={(id, checked) => {
                const next = new Set(selectedClientIds);
                if (checked) next.add(id);
                else next.delete(id);
                onChange({
                  audienceType: 'custom',
                  audienceConfig: {
                    ...audienceConfig,
                    clientIds: [...next],
                  },
                });
              }}
            />
            <PickerList
              title="Contacts"
              empty="No contacts with email."
              options={contactOptions}
              selected={selectedContactIds}
              disabled={disabled}
              onToggle={(id, checked) => {
                const next = new Set(selectedContactIds);
                if (checked) next.add(id);
                else next.delete(id);
                onChange({
                  audienceType: 'custom',
                  audienceConfig: {
                    ...audienceConfig,
                    contactIds: [...next],
                  },
                });
              }}
            />
          </div>
        </div>
      ) : null}

      <p className={`text-xs ${workspaceTextMuted}`}>
        {lockType
          ? 'Unsubscribed and suppressed addresses are still skipped when you send.'
          : growth
            ? 'Growth lists apply filters at send time. Unsubscribed and suppressed addresses are never sent.'
            : savedLists
              ? 'Manual and CSV lists are included on Starter. Upgrade to Growth for logic filters.'
              : 'Subscribe to Campaigns to use saved lists.'}
      </p>
    </div>
  );
}

function PickerList({
  title,
  empty,
  options,
  selected,
  disabled,
  onToggle,
}: {
  title: string;
  empty: string;
  options: AudiencePickerOption[];
  selected: Set<string>;
  disabled?: boolean;
  onToggle: (id: string, checked: boolean) => void;
}) {
  const [query, setQuery] = useState('');
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return options.slice(0, 40);
    return options
      .filter(
        (row) =>
          row.email.includes(q) || row.displayName.toLowerCase().includes(q),
      )
      .slice(0, 40);
  }, [options, query]);

  return (
    <div className="space-y-2">
      <Label className={workspaceText}>{title}</Label>
      <Input
        placeholder={`Search ${title.toLowerCase()}…`}
        value={query}
        disabled={disabled}
        onChange={(event) => setQuery(event.target.value)}
      />
      {options.length === 0 ? (
        <p className={`text-sm ${workspaceTextMuted}`}>{empty}</p>
      ) : (
        <ul className="max-h-40 space-y-2 overflow-y-auto rounded-md border border-[color:var(--workspace-shell-border)] p-2">
          {filtered.map((row) => {
            const id = `audience-pick-${title}-${row.id}`;
            return (
              <li key={row.id} className="flex items-start gap-2">
                <Checkbox
                  id={id}
                  checked={selected.has(row.id)}
                  disabled={disabled}
                  onCheckedChange={(value) => onToggle(row.id, value === true)}
                />
                <label htmlFor={id} className="min-w-0 cursor-pointer text-sm">
                  <span
                    className={`block truncate font-medium ${workspaceText}`}
                  >
                    {row.displayName}
                  </span>
                  <span
                    className={`block truncate text-xs ${workspaceTextMuted}`}
                  >
                    {row.email}
                  </span>
                </label>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
