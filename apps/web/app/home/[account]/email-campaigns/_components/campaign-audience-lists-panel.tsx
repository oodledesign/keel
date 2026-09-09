'use client';

import { useMemo, useState, useTransition } from 'react';

import Link from 'next/link';
import { useRouter } from 'next/navigation';

import { Button } from '@kit/ui/button';
import { Checkbox } from '@kit/ui/checkbox';
import { Input } from '@kit/ui/input';
import { Label } from '@kit/ui/label';
import { toast } from '@kit/ui/sonner';

import pathsConfig from '~/config/paths.config';
import {
  AUDIENCE_FILTER_FIELD_GROUPS,
  AUDIENCE_FILTER_FIELD_LABEL,
  AUDIENCE_FILTER_OP_LABEL,
  AUDIENCE_LIST_SOURCE_LABEL,
  type AudienceFilterOp,
  type AudienceFilterRule,
  type AudienceListFilters,
  type AudienceListSource,
  emptyAudienceFilterRule,
  parseAudienceListFilters,
} from '~/lib/campaigns/campaign-audience-filters';
import type {
  CampaignAudienceList,
  CampaignAudienceListMember,
  CampaignContactCategory,
  CampaignWorkspaceContact,
} from '~/lib/campaigns/campaign.types';
import {
  workspaceBtnPrimary,
  workspacePanelCard,
  workspaceText,
  workspaceTextMuted,
} from '~/lib/workspace-ui';

import {
  createListFromCategoryAction,
  deleteAudienceListAction,
  removeAudienceListMembersAction,
  saveAudienceListAction,
} from '../_lib/server/server-actions';

type ListKind = 'logic' | 'manual';

function listKindOf(list: CampaignAudienceList): ListKind {
  return list.source === 'manual' ? 'manual' : 'logic';
}

export function CampaignAudienceListsPanel({
  accountId,
  accountSlug,
  lists,
  categories,
  contacts,
  membersByList,
}: {
  accountId: string;
  accountSlug: string;
  lists: CampaignAudienceList[];
  categories: CampaignContactCategory[];
  contacts: CampaignWorkspaceContact[];
  membersByList: Record<string, CampaignAudienceListMember[]>;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [kind, setKind] = useState<ListKind>('logic');
  const [name, setName] = useState('');
  const [source, setSource] = useState<AudienceListSource>('subscribers');
  const [matchMode, setMatchMode] =
    useState<AudienceListFilters['matchMode']>('all');
  const [rules, setRules] = useState<AudienceFilterRule[]>([
    emptyAudienceFilterRule(),
  ]);
  const [selectedContactIds, setSelectedContactIds] = useState<string[]>([]);
  const [memberSearch, setMemberSearch] = useState('');
  const [categoryListName, setCategoryListName] = useState('');
  const [categoryListId, setCategoryListId] = useState(categories[0]?.id ?? '');
  const [categoryListMode, setCategoryListMode] = useState<ListKind>('logic');

  const filters = useMemo<AudienceListFilters>(
    () =>
      parseAudienceListFilters({
        source: kind === 'manual' ? 'manual' : source,
        matchMode,
        rules: kind === 'manual' ? [] : rules,
      }),
    [kind, source, matchMode, rules],
  );

  const importHref = `${pathsConfig.app.accountEmailCampaignContactImport.replace(
    '[account]',
    accountSlug,
  )}${editingId ? `?listId=${editingId}` : ''}`;

  const reset = () => {
    setEditingId(null);
    setKind('logic');
    setName('');
    setSource('subscribers');
    setMatchMode('all');
    setRules([emptyAudienceFilterRule()]);
    setSelectedContactIds([]);
    setMemberSearch('');
  };

  const loadList = (list: CampaignAudienceList) => {
    const parsed = parseAudienceListFilters({
      source: list.source,
      matchMode: list.matchMode,
      rules: list.filters,
    });
    setEditingId(list.id);
    setName(list.name);
    setKind(listKindOf(list));
    setSource(parsed.source === 'manual' ? 'contacts' : parsed.source);
    setMatchMode(parsed.matchMode);
    setRules(
      parsed.rules.length > 0 ? parsed.rules : [emptyAudienceFilterRule()],
    );
    setSelectedContactIds(
      (membersByList[list.id] ?? []).map((member) => member.contactId),
    );
  };

  const editingMembers = editingId ? (membersByList[editingId] ?? []) : [];
  const selectableContacts = useMemo(() => {
    const q = memberSearch.trim().toLowerCase();
    return contacts
      .filter((contact) => contact.email)
      .filter((contact) => {
        if (!q) return true;
        return (
          contact.fullName.toLowerCase().includes(q) ||
          (contact.email ?? '').toLowerCase().includes(q) ||
          (contact.companyName ?? '').toLowerCase().includes(q) ||
          (contact.industry ?? '').toLowerCase().includes(q)
        );
      })
      .slice(0, 40);
  }, [contacts, memberSearch]);

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_1fr]">
      <div className="space-y-6">
        <div className={`${workspacePanelCard} space-y-3 p-4`}>
          <h2 className={`font-semibold ${workspaceText}`}>
            {editingId ? 'Edit list' : 'New list'}
          </h2>
          <div className="grid gap-3 sm:grid-cols-2">
            <button
              type="button"
              className={`rounded-md border px-3 py-2 text-left text-sm ${
                kind === 'logic'
                  ? 'border-[color:var(--ozer-accent)] bg-[var(--ozer-accent-subtle)]'
                  : 'border-[color:var(--workspace-shell-border)]'
              } ${workspaceText}`}
              onClick={() => setKind('logic')}
            >
              <span className="block font-medium">Logic list</span>
              <span className={`block text-xs ${workspaceTextMuted}`}>
                Rules on subscribers, clients, or contacts
              </span>
            </button>
            <button
              type="button"
              className={`rounded-md border px-3 py-2 text-left text-sm ${
                kind === 'manual'
                  ? 'border-[color:var(--ozer-accent)] bg-[var(--ozer-accent-subtle)]'
                  : 'border-[color:var(--workspace-shell-border)]'
              } ${workspaceText}`}
              onClick={() => setKind('manual')}
            >
              <span className="block font-medium">Manual list</span>
              <span className={`block text-xs ${workspaceTextMuted}`}>
                Static membership you add and remove
              </span>
            </button>
          </div>
          <div className="space-y-2">
            <Label>Name</Label>
            <Input
              value={name}
              onChange={(event) => setName(event.target.value)}
            />
          </div>

          {kind === 'logic' ? (
            <>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>Source</Label>
                  <select
                    className="border-input bg-background h-9 w-full rounded-md border px-3 text-sm"
                    value={source}
                    onChange={(event) =>
                      setSource(event.target.value as AudienceListSource)
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
                <p className={`text-sm font-medium ${workspaceText}`}>
                  Categories
                </p>
                <p className={`text-xs ${workspaceTextMuted}`}>
                  Category is listed first. Use “is” or “is one of” against
                  workspace categories.
                </p>
                {rules.map((rule, index) => (
                  <RuleRow
                    key={`${rule.field}-${index}`}
                    rule={rule}
                    categories={categories}
                    onChange={(next) => {
                      const copy = [...rules];
                      copy[index] = next;
                      setRules(copy);
                    }}
                  />
                ))}
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    setRules([...rules, emptyAudienceFilterRule()])
                  }
                >
                  Add rule
                </Button>
              </div>
            </>
          ) : (
            <ManualMembersEditor
              contacts={selectableContacts}
              selectedIds={selectedContactIds}
              search={memberSearch}
              onSearchChange={setMemberSearch}
              onToggle={(id, checked) => {
                setSelectedContactIds((current) => {
                  if (checked) return [...new Set([...current, id])];
                  return current.filter((value) => value !== id);
                });
              }}
              existingMembers={editingMembers}
            />
          )}

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
                      contactIds:
                        kind === 'manual' ? selectedContactIds : undefined,
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
            <Button asChild type="button" variant="outline">
              <Link href={importHref}>Upload CSV</Link>
            </Button>
          </div>
        </div>

        <div className={`${workspacePanelCard} space-y-3 p-4`}>
          <h2 className={`font-semibold ${workspaceText}`}>
            List from a category
          </h2>
          <p className={`text-sm ${workspaceTextMuted}`}>
            Dynamic lists stay in sync with the category. Snapshot lists copy
            current members into a manual list.
          </p>
          {categories.length === 0 ? (
            <p className={`text-sm ${workspaceTextMuted}`}>
              Create categories on the Contacts tab first.
            </p>
          ) : (
            <>
              <Input
                placeholder="List name"
                value={categoryListName}
                onChange={(event) => setCategoryListName(event.target.value)}
              />
              <select
                className="border-input bg-background h-9 w-full rounded-md border px-3 text-sm"
                value={categoryListId}
                onChange={(event) => setCategoryListId(event.target.value)}
              >
                {categories.map((category) => (
                  <option key={category.id} value={category.id}>
                    {category.name}
                  </option>
                ))}
              </select>
              <select
                className="border-input bg-background h-9 w-full rounded-md border px-3 text-sm"
                value={categoryListMode}
                onChange={(event) =>
                  setCategoryListMode(event.target.value as ListKind)
                }
              >
                <option value="logic">
                  Dynamic — all contacts in category
                </option>
                <option value="manual">Snapshot — seed a manual list</option>
              </select>
              <Button
                className={workspaceBtnPrimary}
                disabled={
                  pending || !categoryListName.trim() || !categoryListId
                }
                onClick={() => {
                  startTransition(async () => {
                    try {
                      await createListFromCategoryAction({
                        accountId,
                        accountSlug,
                        categoryId: categoryListId,
                        name: categoryListName,
                        mode: categoryListMode,
                      });
                      toast.success('List created from category');
                      setCategoryListName('');
                      router.refresh();
                    } catch (error) {
                      toast.error(
                        error instanceof Error
                          ? error.message
                          : 'Could not create list',
                      );
                    }
                  });
                }}
              >
                Create list
              </Button>
            </>
          )}
        </div>
      </div>

      <div className="space-y-3">
        {lists.length === 0 ? (
          <div className={`${workspacePanelCard} p-6 ${workspaceTextMuted}`}>
            No saved lists yet. Create a logic list, a manual list, or upload a
            CSV.
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
                    {AUDIENCE_LIST_SOURCE_LABEL[list.source]}
                    {list.source === 'manual'
                      ? ` · ${list.memberCount ?? 0} contacts`
                      : ` · ${list.matchMode} of ${
                          Array.isArray(list.filters) ? list.filters.length : 0
                        } rules`}
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
              {list.source === 'manual' && editingId === list.id ? (
                <ManualMemberActions
                  accountId={accountId}
                  accountSlug={accountSlug}
                  listId={list.id}
                  members={membersByList[list.id] ?? []}
                  pending={pending}
                  startTransition={startTransition}
                />
              ) : null}
            </div>
          ))
        )}
      </div>
    </div>
  );
}

function RuleRow({
  rule,
  categories,
  onChange,
}: {
  rule: AudienceFilterRule;
  categories: CampaignContactCategory[];
  onChange: (rule: AudienceFilterRule) => void;
}) {
  const ops: AudienceFilterOp[] =
    rule.field === 'category'
      ? ['eq', 'in']
      : rule.field === 'industry'
        ? ['contains', 'eq', 'in']
        : rule.field === 'subscribed_after' || rule.field === 'created_after'
          ? ['gte']
          : ['eq', 'contains'];

  return (
    <div className="grid gap-2 sm:grid-cols-3">
      <select
        className="border-input bg-background h-9 rounded-md border px-2 text-sm"
        value={rule.field}
        onChange={(event) => {
          const field = event.target.value as AudienceFilterRule['field'];
          onChange({
            field,
            op:
              field === 'category'
                ? 'eq'
                : field === 'industry'
                  ? 'contains'
                  : rule.op,
            value:
              field === 'category' ? (categories[0]?.id ?? '') : rule.value,
          });
        }}
      >
        {AUDIENCE_FILTER_FIELD_GROUPS.map((group) => (
          <optgroup key={group.label} label={group.label}>
            {group.fields.map((field) => (
              <option key={field} value={field}>
                {AUDIENCE_FILTER_FIELD_LABEL[field]}
              </option>
            ))}
          </optgroup>
        ))}
      </select>
      <select
        className="border-input bg-background h-9 rounded-md border px-2 text-sm"
        value={ops.includes(rule.op) ? rule.op : ops[0]}
        onChange={(event) =>
          onChange({ ...rule, op: event.target.value as AudienceFilterOp })
        }
      >
        {ops.map((op) => (
          <option key={op} value={op}>
            {AUDIENCE_FILTER_OP_LABEL[op]}
          </option>
        ))}
      </select>
      {rule.field === 'category' ? (
        <CategoryValueInput
          categories={categories}
          op={rule.op}
          value={rule.value}
          onChange={(value) => onChange({ ...rule, value })}
        />
      ) : (
        <Input
          value={rule.value}
          placeholder={
            rule.field === 'industry'
              ? rule.op === 'in'
                ? 'office, retail, industrial'
                : 'Industry'
              : 'Value'
          }
          onChange={(event) => onChange({ ...rule, value: event.target.value })}
        />
      )}
    </div>
  );
}

function CategoryValueInput({
  categories,
  op,
  value,
  onChange,
}: {
  categories: CampaignContactCategory[];
  op: AudienceFilterOp;
  value: string;
  onChange: (value: string) => void;
}) {
  const selected = new Set(
    value
      .split(',')
      .map((part) => part.trim())
      .filter(Boolean),
  );

  if (categories.length === 0) {
    return (
      <p className={`self-center text-xs ${workspaceTextMuted}`}>
        No categories yet
      </p>
    );
  }

  if (op !== 'in') {
    return (
      <select
        className="border-input bg-background h-9 rounded-md border px-2 text-sm"
        value={value}
        onChange={(event) => onChange(event.target.value)}
      >
        <option value="">Choose category…</option>
        {categories.map((category) => (
          <option key={category.id} value={category.id}>
            {category.name}
          </option>
        ))}
      </select>
    );
  }

  return (
    <div className="max-h-28 space-y-1 overflow-y-auto rounded-md border border-[color:var(--workspace-shell-border)] p-2">
      {categories.map((category) => {
        const id = `rule-cat-${category.id}`;
        return (
          <label key={category.id} className="flex items-center gap-2 text-sm">
            <Checkbox
              id={id}
              checked={selected.has(category.id)}
              onCheckedChange={(checked) => {
                const next = new Set(selected);
                if (checked === true) next.add(category.id);
                else next.delete(category.id);
                onChange([...next].join(','));
              }}
            />
            {category.name}
          </label>
        );
      })}
    </div>
  );
}

function ManualMembersEditor({
  contacts,
  selectedIds,
  search,
  onSearchChange,
  onToggle,
  existingMembers,
}: {
  contacts: CampaignWorkspaceContact[];
  selectedIds: string[];
  search: string;
  onSearchChange: (value: string) => void;
  onToggle: (id: string, checked: boolean) => void;
  existingMembers: CampaignAudienceListMember[];
}) {
  const selected = new Set(selectedIds);
  return (
    <div className="space-y-2">
      <Label>Contacts</Label>
      <Input
        placeholder="Search contacts…"
        value={search}
        onChange={(event) => onSearchChange(event.target.value)}
      />
      <p className={`text-xs ${workspaceTextMuted}`}>
        {selectedIds.length} selected
        {existingMembers.length
          ? ` · ${existingMembers.length} already on this list`
          : ''}
        {' · showing up to 40 — search to refine'}
      </p>
      <ul className="max-h-52 space-y-2 overflow-y-auto rounded-md border border-[color:var(--workspace-shell-border)] p-2">
        {contacts.length === 0 ? (
          <li className={`text-sm ${workspaceTextMuted}`}>
            No contacts with email. Add them on the Contacts tab or upload a
            CSV.
          </li>
        ) : (
          contacts.map((contact) => {
            const id = `manual-member-${contact.id}`;
            return (
              <li key={contact.id} className="flex items-start gap-2">
                <Checkbox
                  id={id}
                  checked={selected.has(contact.id)}
                  onCheckedChange={(value) =>
                    onToggle(contact.id, value === true)
                  }
                />
                <label htmlFor={id} className="min-w-0 cursor-pointer text-sm">
                  <span
                    className={`block truncate font-medium ${workspaceText}`}
                  >
                    {contact.fullName}
                  </span>
                  <span
                    className={`block truncate text-xs ${workspaceTextMuted}`}
                  >
                    {contact.email}
                  </span>
                </label>
              </li>
            );
          })
        )}
      </ul>
    </div>
  );
}

function ManualMemberActions({
  accountId,
  accountSlug,
  listId,
  members,
  pending,
  startTransition,
}: {
  accountId: string;
  accountSlug: string;
  listId: string;
  members: CampaignAudienceListMember[];
  pending: boolean;
  startTransition: (fn: () => void) => void;
}) {
  const router = useRouter();
  if (members.length === 0) return null;
  return (
    <ul className="space-y-1 border-t border-[color:var(--workspace-shell-border)] pt-2">
      {members.slice(0, 12).map((member) => (
        <li
          key={member.id}
          className="flex items-center justify-between gap-2 text-sm"
        >
          <span className={workspaceText}>
            {member.displayName}
            {member.email ? (
              <span className={`ml-2 ${workspaceTextMuted}`}>
                {member.email}
              </span>
            ) : null}
          </span>
          <Button
            size="sm"
            variant="ghost"
            disabled={pending}
            onClick={() => {
              startTransition(() => {
                void removeAudienceListMembersAction({
                  accountId,
                  accountSlug,
                  listId,
                  contactIds: [member.contactId],
                })
                  .then(() => router.refresh())
                  .catch((error: unknown) =>
                    toast.error(
                      error instanceof Error
                        ? error.message
                        : 'Could not remove',
                    ),
                  );
              });
            }}
          >
            Remove
          </Button>
        </li>
      ))}
      {members.length > 12 ? (
        <li className={`text-xs ${workspaceTextMuted}`}>
          +{members.length - 12} more on this list
        </li>
      ) : null}
    </ul>
  );
}
