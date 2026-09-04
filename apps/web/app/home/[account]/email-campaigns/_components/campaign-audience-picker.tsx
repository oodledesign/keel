'use client';

import { useMemo, useState } from 'react';

import { Checkbox } from '@kit/ui/checkbox';
import { Input } from '@kit/ui/input';
import { Label } from '@kit/ui/label';
import { RadioGroup, RadioGroupItem } from '@kit/ui/radio-group';
import { Textarea } from '@kit/ui/textarea';

import {
  AUDIENCE_TYPE_HINT,
  AUDIENCE_TYPE_LABEL,
  type CampaignAudienceConfig,
  type CampaignAudienceType,
  parseAudienceEmailInput,
} from '~/lib/campaigns/campaign-audience';
import {
  workspacePanelCard,
  workspaceText,
  workspaceTextMuted,
} from '~/lib/workspace-ui';

export type AudiencePickerOption = {
  id: string;
  email: string;
  displayName: string;
};

export function CampaignAudiencePicker({
  audienceType,
  audienceConfig,
  estimatedCount,
  counts,
  clients,
  contacts,
  disabled,
  onChange,
}: {
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
  disabled?: boolean;
  onChange: (next: {
    audienceType: CampaignAudienceType;
    audienceConfig: CampaignAudienceConfig;
  }) => void;
}) {
  const [manualText, setManualText] = useState(
    (audienceConfig.emails ?? []).join(', '),
  );

  const selectedClientIds = useMemo(
    () => new Set(audienceConfig.clientIds ?? []),
    [audienceConfig.clientIds],
  );
  const selectedContactIds = useMemo(
    () => new Set(audienceConfig.contactIds ?? []),
    [audienceConfig.contactIds],
  );

  const setType = (next: CampaignAudienceType) => {
    onChange({
      audienceType: next,
      audienceConfig:
        next === 'custom'
          ? audienceConfig
          : { emails: [], clientIds: [], contactIds: [] },
    });
  };

  return (
    <div className={`${workspacePanelCard} space-y-4 p-4`} data-test="campaign-audience-picker">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h2 className={`font-semibold ${workspaceText}`}>Audience</h2>
          <p className={`mt-1 text-sm ${workspaceTextMuted}`}>
            Choose who receives this campaign. Unsubscribed and suppressed
            addresses are never sent.
          </p>
        </div>
        <p className={`text-sm font-medium ${workspaceText}`} data-test="campaign-audience-estimate">
          ~{estimatedCount.toLocaleString()} recipients
        </p>
      </div>

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
          ] as const
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
                  <span className={`ml-2 text-xs font-normal ${workspaceTextMuted}`}>
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

      {audienceType === 'custom' ? (
        <div className="space-y-4 border-t border-[color:var(--workspace-shell-border)] pt-4">
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
              options={contacts}
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
        Saved named lists and filter builders are coming later. For now, pick a
        source or assemble a custom list on this campaign.
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
                  <span className={`block truncate font-medium ${workspaceText}`}>
                    {row.displayName}
                  </span>
                  <span className={`block truncate text-xs ${workspaceTextMuted}`}>
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
