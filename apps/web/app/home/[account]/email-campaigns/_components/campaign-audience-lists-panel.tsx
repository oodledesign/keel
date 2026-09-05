'use client';

import { useMemo, useState, useTransition } from 'react';

import { useRouter } from 'next/navigation';

import { Button } from '@kit/ui/button';
import { Input } from '@kit/ui/input';
import { Label } from '@kit/ui/label';
import { toast } from '@kit/ui/sonner';

import {
  AUDIENCE_FILTER_FIELD_LABEL,
  AUDIENCE_FILTER_OP_LABEL,
  type AudienceFilterRule,
  type AudienceListFilters,
  emptyAudienceFilterRule,
  parseAudienceListFilters,
} from '~/lib/campaigns/campaign-audience-filters';
import type { CampaignAudienceList } from '~/lib/campaigns/campaign.types';
import {
  workspaceBtnPrimary,
  workspacePanelCard,
  workspaceText,
  workspaceTextMuted,
} from '~/lib/workspace-ui';

import {
  deleteAudienceListAction,
  saveAudienceListAction,
} from '../_lib/server/server-actions';

export function CampaignAudienceListsPanel({
  accountId,
  accountSlug,
  lists,
}: {
  accountId: string;
  accountSlug: string;
  lists: CampaignAudienceList[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [source, setSource] =
    useState<AudienceListFilters['source']>('subscribers');
  const [matchMode, setMatchMode] =
    useState<AudienceListFilters['matchMode']>('all');
  const [rules, setRules] = useState<AudienceFilterRule[]>([
    emptyAudienceFilterRule(),
  ]);

  const filters = useMemo<AudienceListFilters>(
    () => parseAudienceListFilters({ source, matchMode, rules }),
    [source, matchMode, rules],
  );

  const reset = () => {
    setEditingId(null);
    setName('');
    setSource('subscribers');
    setMatchMode('all');
    setRules([emptyAudienceFilterRule()]);
  };

  const loadList = (list: CampaignAudienceList) => {
    const parsed = parseAudienceListFilters({
      source: list.source,
      matchMode: list.matchMode,
      rules: list.filters,
    });
    setEditingId(list.id);
    setName(list.name);
    setSource(parsed.source);
    setMatchMode(parsed.matchMode);
    setRules(
      parsed.rules.length > 0 ? parsed.rules : [emptyAudienceFilterRule()],
    );
  };

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_1fr]">
      <div className={`${workspacePanelCard} space-y-3 p-4`}>
        <h2 className={`font-semibold ${workspaceText}`}>
          {editingId ? 'Edit list' : 'New list'}
        </h2>
        <div className="space-y-2">
          <Label>Name</Label>
          <Input
            value={name}
            onChange={(event) => setName(event.target.value)}
          />
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-2">
            <Label>Source</Label>
            <select
              className="border-input bg-background h-9 w-full rounded-md border px-3 text-sm"
              value={source}
              onChange={(event) =>
                setSource(event.target.value as AudienceListFilters['source'])
              }
            >
              <option value="subscribers">Subscribers</option>
              <option value="clients">Clients</option>
              <option value="contacts">Contacts</option>
            </select>
          </div>
          <div className="space-y-2">
            <Label>Match</Label>
            <select
              className="border-input bg-background h-9 w-full rounded-md border px-3 text-sm"
              value={matchMode}
              onChange={(event) =>
                setMatchMode(
                  event.target.value as AudienceListFilters['matchMode'],
                )
              }
            >
              <option value="all">All rules</option>
              <option value="any">Any rule</option>
            </select>
          </div>
        </div>
        <div className="space-y-3">
          {rules.map((rule, index) => (
            <div
              key={`${rule.field}-${index}`}
              className="grid gap-2 sm:grid-cols-3"
            >
              <select
                className="border-input bg-background h-9 rounded-md border px-2 text-sm"
                value={rule.field}
                onChange={(event) => {
                  const next = [...rules];
                  next[index] = {
                    ...rule,
                    field: event.target.value as AudienceFilterRule['field'],
                  };
                  setRules(next);
                }}
              >
                {Object.entries(AUDIENCE_FILTER_FIELD_LABEL).map(
                  ([key, label]) => (
                    <option key={key} value={key}>
                      {label}
                    </option>
                  ),
                )}
              </select>
              <select
                className="border-input bg-background h-9 rounded-md border px-2 text-sm"
                value={rule.op}
                onChange={(event) => {
                  const next = [...rules];
                  next[index] = {
                    ...rule,
                    op: event.target.value as AudienceFilterRule['op'],
                  };
                  setRules(next);
                }}
              >
                {Object.entries(AUDIENCE_FILTER_OP_LABEL).map(
                  ([key, label]) => (
                    <option key={key} value={key}>
                      {label}
                    </option>
                  ),
                )}
              </select>
              <Input
                value={rule.value}
                placeholder="Value"
                onChange={(event) => {
                  const next = [...rules];
                  next[index] = { ...rule, value: event.target.value };
                  setRules(next);
                }}
              />
            </div>
          ))}
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setRules([...rules, emptyAudienceFilterRule()])}
          >
            Add rule
          </Button>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            className={workspaceBtnPrimary}
            disabled={pending || !name.trim()}
            onClick={() => {
              startTransition(async () => {
                try {
                  await saveAudienceListAction({
                    accountId,
                    accountSlug,
                    listId: editingId ?? undefined,
                    name,
                    filters,
                  });
                  toast.success(editingId ? 'List updated' : 'List saved');
                  reset();
                  router.refresh();
                } catch (error) {
                  toast.error(
                    error instanceof Error
                      ? error.message
                      : 'Could not save list',
                  );
                }
              });
            }}
          >
            {editingId ? 'Save list' : 'Create list'}
          </Button>
          {editingId ? (
            <Button type="button" variant="ghost" onClick={reset}>
              Cancel
            </Button>
          ) : null}
        </div>
      </div>

      <div className="space-y-3">
        {lists.length === 0 ? (
          <div className={`${workspacePanelCard} p-6 ${workspaceTextMuted}`}>
            No saved lists yet. Filter subscribers, clients, or contacts and
            reuse the list on any campaign.
          </div>
        ) : (
          lists.map((list) => (
            <div
              key={list.id}
              className={`${workspacePanelCard} space-y-2 p-4`}
            >
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className={`font-semibold ${workspaceText}`}>
                    {list.name}
                  </p>
                  <p className={`text-sm ${workspaceTextMuted}`}>
                    {list.source} · {list.matchMode} of{' '}
                    {Array.isArray(list.filters) ? list.filters.length : 0}{' '}
                    rules
                  </p>
                </div>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => loadList(list)}
                  >
                    Edit
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    disabled={pending}
                    onClick={() => {
                      startTransition(async () => {
                        try {
                          await deleteAudienceListAction({
                            accountId,
                            accountSlug,
                            listId: list.id,
                          });
                          toast.success('List deleted');
                          router.refresh();
                        } catch (error) {
                          toast.error(
                            error instanceof Error
                              ? error.message
                              : 'Could not delete',
                          );
                        }
                      });
                    }}
                  >
                    Delete
                  </Button>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
