'use client';

import {
  type TransitionStartFunction,
  useMemo,
  useState,
  useTransition,
} from 'react';

import Link from 'next/link';
import { useRouter } from 'next/navigation';

import { Button } from '@kit/ui/button';
import { Checkbox } from '@kit/ui/checkbox';
import { Input } from '@kit/ui/input';
import { Label } from '@kit/ui/label';
import { toast } from '@kit/ui/sonner';

import pathsConfig from '~/config/paths.config';
import { hasCampaignsGrowthFeatures } from '~/lib/billing/campaign-pricing';
import type {
  CampaignAudienceList,
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
  archiveContactCategoryAction,
  assignContactCategoriesAction,
  bulkAddContactsToListAction,
  saveCampaignContactAction,
  saveContactCategoryAction,
} from '../_lib/server/server-actions';
import { CampaignUpgradeCta } from './campaign-upgrade-cta';

export function CampaignContactsPage({
  accountId,
  accountSlug,
  contacts,
  categories,
  lists,
  planTier,
  nextTierName,
  initialQuery,
  initialCategoryId,
  initialIndustry,
}: {
  accountId: string;
  accountSlug: string;
  contacts: CampaignWorkspaceContact[];
  categories: CampaignContactCategory[];
  lists: CampaignAudienceList[];
  planTier: string;
  nextTierName?: string | null;
  initialQuery?: string;
  initialCategoryId?: string;
  initialIndustry?: string;
}) {
  const router = useRouter();
  const growth = hasCampaignsGrowthFeatures(planTier);
  const [pending, startTransition] = useTransition();
  const [query, setQuery] = useState(initialQuery ?? '');
  const [categoryFilter, setCategoryFilter] = useState(initialCategoryId ?? '');
  const [industryFilter, setIndustryFilter] = useState(initialIndustry ?? '');
  const [selected, setSelected] = useState<string[]>([]);
  const [listId, setListId] = useState(
    lists.find((list) => list.source === 'manual')?.id ?? '',
  );
  const [newListName, setNewListName] = useState('');
  const [bulkCategoryId, setBulkCategoryId] = useState(categories[0]?.id ?? '');
  const [editing, setEditing] = useState<CampaignWorkspaceContact | null>(null);
  const [creating, setCreating] = useState(false);

  const categoryName = useMemo(
    () => new Map(categories.map((row) => [row.id, row.name])),
    [categories],
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return contacts.filter((contact) => {
      if (categoryFilter && !contact.categoryIds.includes(categoryFilter)) {
        return false;
      }
      if (
        industryFilter &&
        !(contact.industry ?? '')
          .toLowerCase()
          .includes(industryFilter.trim().toLowerCase())
      ) {
        return false;
      }
      if (!q) return true;
      return (
        contact.fullName.toLowerCase().includes(q) ||
        (contact.email ?? '').toLowerCase().includes(q) ||
        (contact.phone ?? '').toLowerCase().includes(q) ||
        (contact.companyName ?? '').toLowerCase().includes(q) ||
        (contact.industry ?? '').toLowerCase().includes(q)
      );
    });
  }, [contacts, query, categoryFilter, industryFilter]);

  const selectedSet = new Set(selected);
  const allVisibleSelected =
    filtered.length > 0 && filtered.every((row) => selectedSet.has(row.id));

  const applySearch = () => {
    const params = new URLSearchParams();
    if (query.trim()) params.set('q', query.trim());
    if (categoryFilter) params.set('category', categoryFilter);
    if (industryFilter.trim()) params.set('industry', industryFilter.trim());
    const href = `${pathsConfig.app.accountEmailCampaignContacts.replace(
      '[account]',
      accountSlug,
    )}${params.toString() ? `?${params}` : ''}`;
    router.push(href);
  };

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_280px]">
      <div className="space-y-4">
        <div className="flex flex-wrap items-end gap-2">
          <div className="min-w-[12rem] flex-1 space-y-1">
            <Label>Search</Label>
            <Input
              value={query}
              placeholder="Name, email, company…"
              onChange={(event) => setQuery(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') applySearch();
              }}
            />
          </div>
          <div className="w-48 space-y-1">
            <Label>Category</Label>
            <select
              className="border-input bg-background h-9 w-full rounded-md border px-3 text-sm"
              value={categoryFilter}
              onChange={(event) => setCategoryFilter(event.target.value)}
            >
              <option value="">All contacts</option>
              {categories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
            </select>
          </div>
          <div className="w-44 space-y-1">
            <Label>Industry</Label>
            <Input
              list="campaign-contact-industries"
              value={industryFilter}
              placeholder="Any industry"
              onChange={(event) => setIndustryFilter(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') applySearch();
              }}
            />
            <datalist id="campaign-contact-industries">
              {[
                ...new Set(
                  contacts
                    .map((contact) => contact.industry?.trim())
                    .filter((value): value is string => Boolean(value)),
                ),
              ]
                .sort((a, b) => a.localeCompare(b))
                .map((value) => (
                  <option key={value} value={value} />
                ))}
            </datalist>
          </div>
          <Button type="button" variant="outline" onClick={applySearch}>
            Filter
          </Button>
          <Button
            type="button"
            className={workspaceBtnPrimary}
            onClick={() => {
              setCreating(true);
              setEditing(null);
            }}
          >
            New contact
          </Button>
          {growth ? (
            <Button asChild variant="outline">
              <Link
                href={pathsConfig.app.accountEmailCampaignContactImport.replace(
                  '[account]',
                  accountSlug,
                )}
              >
                Upload CSV
              </Link>
            </Button>
          ) : null}
        </div>

        {selected.length > 0 && growth ? (
          <div className={`${workspacePanelCard} space-y-3 p-4`}>
            <p className={`text-sm font-medium ${workspaceText}`}>
              {selected.length} selected
            </p>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Add to existing list</Label>
                <select
                  className="border-input bg-background h-9 w-full rounded-md border px-3 text-sm"
                  value={listId}
                  onChange={(event) => setListId(event.target.value)}
                >
                  <option value="">Choose a manual list…</option>
                  {lists
                    .filter((list) => list.source === 'manual')
                    .map((list) => (
                      <option key={list.id} value={list.id}>
                        {list.name}
                      </option>
                    ))}
                </select>
                <Button
                  size="sm"
                  disabled={pending || !listId}
                  onClick={() => {
                    startTransition(async () => {
                      try {
                        await bulkAddContactsToListAction({
                          accountId,
                          accountSlug,
                          listId,
                          contactIds: selected,
                        });
                        toast.success('Added to list');
                        setSelected([]);
                        router.refresh();
                      } catch (error) {
                        toast.error(
                          error instanceof Error
                            ? error.message
                            : 'Could not add to list',
                        );
                      }
                    });
                  }}
                >
                  Add to list
                </Button>
              </div>
              <div className="space-y-2">
                <Label>Or create a new list</Label>
                <Input
                  placeholder="New list name"
                  value={newListName}
                  onChange={(event) => setNewListName(event.target.value)}
                />
                <Button
                  size="sm"
                  disabled={pending || !newListName.trim()}
                  onClick={() => {
                    startTransition(async () => {
                      try {
                        await bulkAddContactsToListAction({
                          accountId,
                          accountSlug,
                          newListName,
                          contactIds: selected,
                        });
                        toast.success('List created');
                        setNewListName('');
                        setSelected([]);
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
                  Create list from selection
                </Button>
              </div>
            </div>
            {categories.length > 0 ? (
              <div className="flex flex-wrap items-end gap-2">
                <div className="space-y-1">
                  <Label>Assign category</Label>
                  <select
                    className="border-input bg-background h-9 rounded-md border px-3 text-sm"
                    value={bulkCategoryId}
                    onChange={(event) => setBulkCategoryId(event.target.value)}
                  >
                    {categories.map((category) => (
                      <option key={category.id} value={category.id}>
                        {category.name}
                      </option>
                    ))}
                  </select>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={pending || !bulkCategoryId}
                  onClick={() => {
                    startTransition(async () => {
                      try {
                        await assignContactCategoriesAction({
                          accountId,
                          accountSlug,
                          contactIds: selected,
                          categoryIds: [bulkCategoryId],
                        });
                        toast.success('Category assigned');
                        router.refresh();
                      } catch (error) {
                        toast.error(
                          error instanceof Error
                            ? error.message
                            : 'Could not assign',
                        );
                      }
                    });
                  }}
                >
                  Assign to selected
                </Button>
              </div>
            ) : null}
          </div>
        ) : null}

        {!growth ? (
          <CampaignUpgradeCta
            accountSlug={accountSlug}
            nextTierName={nextTierName ?? 'Growth'}
            message="Lists, CSV import, and categories start on Campaigns Growth."
          />
        ) : null}

        <div className={`${workspacePanelCard} overflow-hidden`}>
          <table
            className="w-full text-left text-sm"
            data-test="campaign-contacts-table"
          >
            <thead className="bg-[var(--workspace-shell-sidebar-accent)]">
              <tr className={workspaceTextMuted}>
                <th className="w-10 px-3 py-2">
                  <Checkbox
                    checked={allVisibleSelected}
                    onCheckedChange={(value) => {
                      if (value === true) {
                        setSelected(filtered.map((row) => row.id));
                      } else {
                        setSelected([]);
                      }
                    }}
                    aria-label="Select all visible contacts"
                  />
                </th>
                <th className="px-3 py-2 font-medium">Name</th>
                <th className="px-3 py-2 font-medium">Email</th>
                <th className="px-3 py-2 font-medium">Company</th>
                <th className="px-3 py-2 font-medium">Industry</th>
                <th className="px-3 py-2 font-medium">Categories</th>
                <th className="px-3 py-2 font-medium" />
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={7} className={`px-3 py-6 ${workspaceTextMuted}`}>
                    No contacts match. Create one or upload a CSV.
                  </td>
                </tr>
              ) : (
                filtered.map((contact) => (
                  <tr
                    key={contact.id}
                    className="border-t border-[color:var(--workspace-shell-border)]"
                  >
                    <td className="px-3 py-2">
                      <Checkbox
                        checked={selectedSet.has(contact.id)}
                        onCheckedChange={(value) => {
                          setSelected((current) =>
                            value === true
                              ? [...new Set([...current, contact.id])]
                              : current.filter((id) => id !== contact.id),
                          );
                        }}
                        aria-label={`Select ${contact.fullName}`}
                      />
                    </td>
                    <td className={`px-3 py-2 font-medium ${workspaceText}`}>
                      {contact.fullName}
                    </td>
                    <td className={`px-3 py-2 ${workspaceTextMuted}`}>
                      {contact.email || '—'}
                    </td>
                    <td className={`px-3 py-2 ${workspaceTextMuted}`}>
                      {contact.companyName || '—'}
                    </td>
                    <td className={`px-3 py-2 ${workspaceTextMuted}`}>
                      {contact.industry || '—'}
                    </td>
                    <td className={`px-3 py-2 ${workspaceTextMuted}`}>
                      {contact.categoryIds
                        .map((id) => categoryName.get(id))
                        .filter(Boolean)
                        .join(', ') || '—'}
                    </td>
                    <td className="px-3 py-2 text-right">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => {
                          setEditing(contact);
                          setCreating(false);
                        }}
                      >
                        Edit
                      </Button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="space-y-4">
        {growth ? (
          <CategoriesPanel
            accountId={accountId}
            accountSlug={accountSlug}
            categories={categories}
            pending={pending}
            startTransition={startTransition}
          />
        ) : (
          <div className={`${workspacePanelCard} p-4 ${workspaceTextMuted}`}>
            Categories are available on Growth and Pro.
          </div>
        )}
      </div>

      {creating || editing ? (
        <ContactFormDialog
          accountId={accountId}
          accountSlug={accountSlug}
          contact={editing}
          categories={growth ? categories : []}
          pending={pending}
          onClose={() => {
            setCreating(false);
            setEditing(null);
          }}
          startTransition={startTransition}
        />
      ) : null}
    </div>
  );
}

function CategoriesPanel({
  accountId,
  accountSlug,
  categories,
  pending,
  startTransition,
}: {
  accountId: string;
  accountSlug: string;
  categories: CampaignContactCategory[];
  pending: boolean;
  startTransition: TransitionStartFunction;
}) {
  const router = useRouter();
  const [name, setName] = useState('');
  const [renameId, setRenameId] = useState<string | null>(null);
  const [rename, setRename] = useState('');

  return (
    <div className={`${workspacePanelCard} space-y-3 p-4`}>
      <h2 className={`font-semibold ${workspaceText}`}>Categories</h2>
      <div className="flex gap-2">
        <Input
          placeholder="New category"
          value={name}
          onChange={(event) => setName(event.target.value)}
        />
        <Button
          size="sm"
          className={workspaceBtnPrimary}
          disabled={pending || !name.trim()}
          onClick={() => {
            startTransition(async () => {
              try {
                await saveContactCategoryAction({
                  accountId,
                  accountSlug,
                  name,
                });
                toast.success('Category created');
                setName('');
                router.refresh();
              } catch (error) {
                toast.error(
                  error instanceof Error
                    ? error.message
                    : 'Could not create category',
                );
              }
            });
          }}
        >
          Add
        </Button>
      </div>
      <ul className="space-y-2">
        {categories.length === 0 ? (
          <li className={`text-sm ${workspaceTextMuted}`}>
            No categories yet.
          </li>
        ) : (
          categories.map((category) => (
            <li key={category.id} className="space-y-1">
              {renameId === category.id ? (
                <div className="flex gap-2">
                  <Input
                    value={rename}
                    onChange={(event) => setRename(event.target.value)}
                  />
                  <Button
                    size="sm"
                    disabled={pending || !rename.trim()}
                    onClick={() => {
                      startTransition(async () => {
                        try {
                          await saveContactCategoryAction({
                            accountId,
                            accountSlug,
                            categoryId: category.id,
                            name: rename,
                          });
                          toast.success('Category renamed');
                          setRenameId(null);
                          router.refresh();
                        } catch (error) {
                          toast.error(
                            error instanceof Error
                              ? error.message
                              : 'Could not rename',
                          );
                        }
                      });
                    }}
                  >
                    Save
                  </Button>
                </div>
              ) : (
                <div className="flex items-center justify-between gap-2">
                  <span className={`text-sm ${workspaceText}`}>
                    {category.name}
                  </span>
                  <div className="flex gap-1">
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => {
                        setRenameId(category.id);
                        setRename(category.name);
                      }}
                    >
                      Rename
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      disabled={pending}
                      onClick={() => {
                        startTransition(async () => {
                          try {
                            await archiveContactCategoryAction({
                              accountId,
                              accountSlug,
                              categoryId: category.id,
                            });
                            toast.success('Category disabled');
                            router.refresh();
                          } catch (error) {
                            toast.error(
                              error instanceof Error
                                ? error.message
                                : 'Could not disable',
                            );
                          }
                        });
                      }}
                    >
                      Disable
                    </Button>
                  </div>
                </div>
              )}
            </li>
          ))
        )}
      </ul>
    </div>
  );
}

function ContactFormDialog({
  accountId,
  accountSlug,
  contact,
  categories,
  pending,
  onClose,
  startTransition,
}: {
  accountId: string;
  accountSlug: string;
  contact: CampaignWorkspaceContact | null;
  categories: CampaignContactCategory[];
  pending: boolean;
  onClose: () => void;
  startTransition: TransitionStartFunction;
}) {
  const router = useRouter();
  const [email, setEmail] = useState(contact?.email ?? '');
  const [firstName, setFirstName] = useState(contact?.firstName ?? '');
  const [lastName, setLastName] = useState(contact?.lastName ?? '');
  const [phone, setPhone] = useState(contact?.phone ?? '');
  const [companyName, setCompanyName] = useState(contact?.companyName ?? '');
  const [industry, setIndustry] = useState(contact?.industry ?? '');
  const [categoryIds, setCategoryIds] = useState<string[]>(
    contact?.categoryIds ?? [],
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className={`${workspacePanelCard} w-full max-w-lg space-y-3 p-5`}>
        <h2 className={`font-semibold ${workspaceText}`}>
          {contact ? 'Edit contact' : 'New contact'}
        </h2>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1">
            <Label>First name</Label>
            <Input
              value={firstName}
              onChange={(event) => setFirstName(event.target.value)}
            />
          </div>
          <div className="space-y-1">
            <Label>Last name</Label>
            <Input
              value={lastName}
              onChange={(event) => setLastName(event.target.value)}
            />
          </div>
        </div>
        <div className="space-y-1">
          <Label>Email</Label>
          <Input
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
          />
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1">
            <Label>Phone</Label>
            <Input
              value={phone}
              onChange={(event) => setPhone(event.target.value)}
            />
          </div>
          <div className="space-y-1">
            <Label>Company</Label>
            <Input
              value={companyName}
              onChange={(event) => setCompanyName(event.target.value)}
            />
          </div>
        </div>
        <div className="space-y-1">
          <Label>Industry</Label>
          <Input
            value={industry}
            placeholder="e.g. Commercial property"
            onChange={(event) => setIndustry(event.target.value)}
          />
        </div>
        {categories.length > 0 ? (
          <div className="space-y-2">
            <Label>Categories</Label>
            <div className="max-h-32 space-y-1 overflow-y-auto rounded-md border border-[color:var(--workspace-shell-border)] p-2">
              {categories.map((category) => {
                const id = `contact-cat-${category.id}`;
                return (
                  <label
                    key={category.id}
                    className="flex items-center gap-2 text-sm"
                  >
                    <Checkbox
                      id={id}
                      checked={categoryIds.includes(category.id)}
                      onCheckedChange={(value) => {
                        setCategoryIds((current) =>
                          value === true
                            ? [...current, category.id]
                            : current.filter((item) => item !== category.id),
                        );
                      }}
                    />
                    {category.name}
                  </label>
                );
              })}
            </div>
          </div>
        ) : null}
        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button
            className={workspaceBtnPrimary}
            disabled={pending || !email.trim()}
            onClick={() => {
              startTransition(async () => {
                try {
                  await saveCampaignContactAction({
                    accountId,
                    accountSlug,
                    contactId: contact?.id,
                    email,
                    firstName,
                    lastName,
                    phone,
                    companyName,
                    industry,
                    categoryIds,
                  });
                  toast.success(
                    contact ? 'Contact updated' : 'Contact created',
                  );
                  onClose();
                  router.refresh();
                } catch (error) {
                  toast.error(
                    error instanceof Error
                      ? error.message
                      : 'Could not save contact',
                  );
                }
              });
            }}
          >
            Save
          </Button>
        </div>
      </div>
    </div>
  );
}
