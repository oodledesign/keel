'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';

import {
  Check,
  ChevronsUpDown,
  Mail,
  MoreHorizontal,
  Pencil,
  Phone,
  PlusCircle,
  Star,
  Trash2,
} from 'lucide-react';

import { Button } from '@kit/ui/button';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@kit/ui/command';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@kit/ui/dropdown-menu';
import { Input } from '@kit/ui/input';
import { Label } from '@kit/ui/label';
import { Popover, PopoverContent, PopoverTrigger } from '@kit/ui/popover';
import { toast } from '@kit/ui/sonner';
import { cn } from '@kit/ui/utils';

import {
  CONTACT_ROLE_LABELS,
  CONTACT_ROLE_PRESETS,
  type ContactRolePreset,
  formatContactRoleLabel,
  normalizeContactRole,
} from '~/lib/clients/contact-roles';

import {
  createContact,
  deleteContact,
  linkContact,
  listAccountContacts,
  listContacts,
  setPrimaryContact,
  updateContact,
  updateContactLink,
} from '../_lib/server/server-actions';
import { ContactImageUploader } from './contact-image-uploader';

type Contact = {
  id: string;
  full_name: string;
  first_name?: string | null;
  last_name?: string | null;
  email: string | null;
  phone: string | null;
  role: string | null;
  is_primary: boolean;
  picture_url: string | null;
};

type AccountContact = {
  id: string;
  full_name: string;
  email: string | null;
  phone: string | null;
};

type AddMode = 'new' | 'existing';

function RoleSelect({
  id,
  value,
  onChange,
}: {
  id: string;
  value: string;
  onChange: (value: string) => void;
}) {
  const normalized = normalizeContactRole(value) ?? '';
  const isPreset = CONTACT_ROLE_PRESETS.includes(
    normalized as ContactRolePreset,
  );
  return (
    <div className="space-y-2">
      <Label htmlFor={id} className="text-xs">
        Role
      </Label>
      <select
        id={id}
        value={isPreset || !normalized ? normalized : 'other'}
        onChange={(e) => onChange(e.target.value)}
        className="border-input bg-background h-8 w-full rounded-md border px-2 text-sm"
      >
        <option value="">Select role…</option>
        {CONTACT_ROLE_PRESETS.map((role) => (
          <option key={role} value={role}>
            {CONTACT_ROLE_LABELS[role]}
          </option>
        ))}
      </select>
      {normalized === 'other' || (!isPreset && normalized) ? (
        <Input
          value={!isPreset ? value : ''}
          onChange={(e) => onChange(e.target.value || 'other')}
          placeholder="Custom role"
          className="h-8 text-sm"
        />
      ) : null}
    </div>
  );
}

function AddContactForm({
  accountId,
  clientId,
  onAdded,
  onCancel,
}: {
  accountId: string;
  clientId: string;
  onAdded: () => void;
  onCancel: () => void;
}) {
  const [mode, setMode] = useState<AddMode>('new');
  const [saving, setSaving] = useState(false);
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [role, setRole] = useState('');
  const [isPrimary, setIsPrimary] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [accountContacts, setAccountContacts] = useState<AccountContact[]>([]);
  const [loadingContacts, setLoadingContacts] = useState(false);
  const [selectedContactId, setSelectedContactId] = useState('');

  const loadAccountContacts = useCallback(
    async (query?: string) => {
      setLoadingContacts(true);
      try {
        const result = (await listAccountContacts({
          accountId,
          clientId,
          query: query?.trim() || undefined,
        })) as { data?: AccountContact[] };
        setAccountContacts(Array.isArray(result?.data) ? result.data : []);
      } catch {
        setAccountContacts([]);
      } finally {
        setLoadingContacts(false);
      }
    },
    [accountId, clientId],
  );

  useEffect(() => {
    if (mode !== 'existing') return;
    const timer = window.setTimeout(() => {
      void loadAccountContacts(searchQuery);
    }, 200);
    return () => window.clearTimeout(timer);
  }, [loadAccountContacts, mode, searchQuery]);

  const selectedContact = useMemo(
    () => accountContacts.find((c) => c.id === selectedContactId) ?? null,
    [accountContacts, selectedContactId],
  );

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!firstName.trim()) {
      toast.error('First name is required');
      return;
    }
    setSaving(true);
    try {
      await createContact({
        accountId,
        clientId,
        firstName: firstName.trim(),
        lastName: lastName.trim() || undefined,
        email: email.trim() || undefined,
        phone: phone.trim() || undefined,
        role: role.trim() || undefined,
        isPrimary,
      });
      toast.success('Contact added');
      onAdded();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to add contact');
    } finally {
      setSaving(false);
    }
  };

  const handleLink = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedContactId) {
      toast.error('Select a contact to link');
      return;
    }
    setSaving(true);
    try {
      await linkContact({
        accountId,
        clientId,
        contactId: selectedContactId,
        role: role.trim() || undefined,
        isPrimary,
      });
      toast.success('Contact linked to this client');
      onAdded();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to link contact');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-3 rounded-lg border border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-panel)] p-4">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm font-medium text-[var(--workspace-shell-text)]">
          Add contact
        </p>
        <div className="flex rounded-md border border-[color:var(--workspace-shell-border)] p-0.5 text-xs">
          <button
            type="button"
            onClick={() => setMode('new')}
            className={cn(
              'rounded px-2 py-1',
              mode === 'new'
                ? 'bg-[var(--workspace-shell-panel-hover)] text-[var(--workspace-shell-text)]'
                : 'text-[var(--workspace-shell-text-muted)] hover:text-[var(--workspace-shell-text)]',
            )}
          >
            New
          </button>
          <button
            type="button"
            onClick={() => setMode('existing')}
            className={cn(
              'rounded px-2 py-1',
              mode === 'existing'
                ? 'bg-[var(--workspace-shell-panel-hover)] text-[var(--workspace-shell-text)]'
                : 'text-[var(--workspace-shell-text-muted)] hover:text-[var(--workspace-shell-text)]',
            )}
          >
            Existing
          </button>
        </div>
      </div>

      {mode === 'new' ? (
        <form onSubmit={handleCreate} className="space-y-3">
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-2">
              <Label htmlFor="contact_first_name" className="text-xs">
                First name *
              </Label>
              <Input
                id="contact_first_name"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                placeholder="e.g. Jane"
                className="h-8 text-sm"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="contact_last_name" className="text-xs">
                Last name
              </Label>
              <Input
                id="contact_last_name"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                placeholder="e.g. Smith"
                className="h-8 text-sm"
              />
            </div>
          </div>
          <RoleSelect id="contact_role" value={role} onChange={setRole} />
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-2">
              <Label htmlFor="contact_email" className="text-xs">
                Email
              </Label>
              <Input
                id="contact_email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="email@example.com"
                className="h-8 text-sm"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="contact_phone" className="text-xs">
                Phone
              </Label>
              <Input
                id="contact_phone"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="Phone number"
                className="h-8 text-sm"
              />
            </div>
          </div>
          <label className="flex items-center gap-2 text-xs text-[var(--workspace-shell-text-muted)]">
            <input
              type="checkbox"
              checked={isPrimary}
              onChange={(e) => setIsPrimary(e.target.checked)}
              className="rounded border-[color:var(--workspace-shell-border)]"
            />
            Set as primary contact
          </label>
          <div className="flex gap-2 pt-1">
            <Button type="submit" size="sm" disabled={saving}>
              {saving ? 'Adding…' : 'Add contact'}
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={onCancel}
            >
              Cancel
            </Button>
          </div>
        </form>
      ) : (
        <form onSubmit={handleLink} className="space-y-3">
          <div className="space-y-2">
            <Label className="text-xs">Contact *</Label>
            <Popover open={searchOpen} onOpenChange={setSearchOpen}>
              <PopoverTrigger asChild>
                <Button
                  type="button"
                  variant="outline"
                  role="combobox"
                  aria-expanded={searchOpen}
                  className={cn(
                    'w-full justify-between border-[color:var(--workspace-shell-border)] bg-[var(--workspace-control-surface)] text-[var(--workspace-shell-text)] hover:bg-[var(--workspace-shell-panel-hover)] hover:text-[var(--workspace-shell-text)]',
                    !selectedContact &&
                      'text-[var(--workspace-shell-text-muted)]',
                  )}
                >
                  {selectedContact
                    ? `${selectedContact.full_name}${selectedContact.email ? ` · ${selectedContact.email}` : ''}`
                    : 'Search workspace contacts…'}
                  <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent
                className="w-[var(--radix-popover-trigger-width)] border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-panel)] p-0"
                align="start"
              >
                <Command
                  className="bg-[var(--workspace-shell-panel)]"
                  shouldFilter={false}
                >
                  <CommandInput
                    placeholder="Search by name or email…"
                    value={searchQuery}
                    onValueChange={setSearchQuery}
                    className="border-[color:var(--workspace-shell-border)] bg-[var(--workspace-control-surface)] text-[var(--workspace-shell-text)] placeholder:text-[var(--workspace-shell-text-muted)]"
                  />
                  <CommandList>
                    <CommandEmpty>
                      {loadingContacts
                        ? 'Searching…'
                        : 'No contacts found in this workspace.'}
                    </CommandEmpty>
                    <CommandGroup>
                      {accountContacts.map((contact) => {
                        const label = `${contact.full_name}${contact.email ? ` · ${contact.email}` : ''}`;
                        return (
                          <CommandItem
                            key={contact.id}
                            value={label}
                            onSelect={() => {
                              setSelectedContactId(contact.id);
                              setSearchOpen(false);
                            }}
                            className="text-[var(--workspace-shell-text-muted)] aria-selected:bg-[var(--workspace-control-surface)]"
                          >
                            <Check
                              className={cn(
                                'mr-2 h-4 w-4',
                                selectedContactId === contact.id
                                  ? 'opacity-100'
                                  : 'opacity-0',
                              )}
                            />
                            {label}
                          </CommandItem>
                        );
                      })}
                    </CommandGroup>
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
          </div>
          <RoleSelect id="link_role" value={role} onChange={setRole} />
          <label className="flex items-center gap-2 text-xs text-[var(--workspace-shell-text-muted)]">
            <input
              type="checkbox"
              checked={isPrimary}
              onChange={(e) => setIsPrimary(e.target.checked)}
              className="rounded border-[color:var(--workspace-shell-border)]"
            />
            Set as primary contact
          </label>
          <div className="flex gap-2 pt-1">
            <Button
              type="submit"
              size="sm"
              disabled={saving || !selectedContactId}
            >
              {saving ? 'Linking…' : 'Link contact'}
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={onCancel}
            >
              Cancel
            </Button>
          </div>
        </form>
      )}
    </div>
  );
}

function EditContactForm({
  accountId,
  clientId,
  contact,
  onSaved,
  onCancel,
}: {
  accountId: string;
  clientId: string;
  contact: Contact;
  onSaved: () => void;
  onCancel: () => void;
}) {
  const [saving, setSaving] = useState(false);
  const [firstName, setFirstName] = useState(
    contact.first_name?.trim() ||
      contact.full_name.trim().split(/\s+/)[0] ||
      '',
  );
  const [lastName, setLastName] = useState(
    contact.last_name?.trim() ||
      contact.full_name.trim().split(/\s+/).slice(1).join(' ') ||
      '',
  );
  const [email, setEmail] = useState(contact.email ?? '');
  const [phone, setPhone] = useState(contact.phone ?? '');
  const [role, setRole] = useState(contact.role ?? '');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!firstName.trim()) {
      toast.error('First name is required');
      return;
    }
    setSaving(true);
    try {
      await updateContact({
        accountId,
        clientId,
        contactId: contact.id,
        firstName: firstName.trim(),
        lastName: lastName.trim() || null,
        email: email.trim() || null,
        phone: phone.trim() || null,
        role: role.trim() || null,
      });
      toast.success('Contact updated');
      onSaved();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to update contact');
    } finally {
      setSaving(false);
    }
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="space-y-3 rounded-lg border border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-panel)] p-4"
    >
      <p className="text-sm font-medium text-[var(--workspace-shell-text)]">
        Edit contact
      </p>
      <div className="grid grid-cols-2 gap-2">
        <div className="space-y-2">
          <Label htmlFor="edit_contact_first_name" className="text-xs">
            First name *
          </Label>
          <Input
            id="edit_contact_first_name"
            value={firstName}
            onChange={(e) => setFirstName(e.target.value)}
            className="h-8 text-sm"
            required
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="edit_contact_last_name" className="text-xs">
            Last name
          </Label>
          <Input
            id="edit_contact_last_name"
            value={lastName}
            onChange={(e) => setLastName(e.target.value)}
            className="h-8 text-sm"
          />
        </div>
      </div>
      <RoleSelect id="edit_contact_role" value={role} onChange={setRole} />
      <div className="grid grid-cols-2 gap-2">
        <div className="space-y-2">
          <Label htmlFor="edit_contact_email" className="text-xs">
            Email
          </Label>
          <Input
            id="edit_contact_email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="h-8 text-sm"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="edit_contact_phone" className="text-xs">
            Phone
          </Label>
          <Input
            id="edit_contact_phone"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            className="h-8 text-sm"
          />
        </div>
      </div>
      <div className="flex gap-2 pt-1">
        <Button type="submit" size="sm" disabled={saving}>
          {saving ? 'Saving…' : 'Save changes'}
        </Button>
        <Button type="button" size="sm" variant="outline" onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </form>
  );
}

export function ClientContactsBlock({
  accountId,
  clientId,
  canEdit,
}: {
  accountId: string;
  clientId: string;
  canEdit: boolean;
}) {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingContactId, setEditingContactId] = useState<string | null>(null);

  const [editingCustomRoleId, setEditingCustomRoleId] = useState<string | null>(
    null,
  );
  const [customRoleDraft, setCustomRoleDraft] = useState('');

  const fetchContacts = useCallback(async () => {
    setLoading(true);
    try {
      const result = (await listContacts({ accountId, clientId })) as {
        data: Contact[];
      };
      setContacts(Array.isArray(result?.data) ? result.data : []);
    } catch {
      setContacts([]);
    } finally {
      setLoading(false);
    }
  }, [accountId, clientId]);

  useEffect(() => {
    fetchContacts();
  }, [fetchContacts]);

  const handleDelete = async (contactId: string) => {
    if (!confirm('Remove this contact from this client?')) return;
    try {
      await deleteContact({ accountId, clientId, contactId });
      toast.success('Contact removed from this client');
      fetchContacts();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to remove contact');
    }
  };

  const handleSetPrimary = async (contactId: string) => {
    try {
      await setPrimaryContact({ accountId, clientId, contactId });
      toast.success('Primary contact updated');
      fetchContacts();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to set primary');
    }
  };

  const handleRoleChange = async (contactId: string, role: string) => {
    try {
      await updateContactLink({
        accountId,
        clientId,
        contactId,
        role: role || null,
      });
      toast.success('Role updated');
      fetchContacts();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to update role');
    }
  };

  if (loading) {
    return (
      <p className="text-xs text-[var(--workspace-shell-text-muted)]">
        Loading contacts…
      </p>
    );
  }

  return (
    <div className="space-y-3">
      {contacts.length === 0 && !showAddForm && (
        <p className="text-xs text-[var(--workspace-shell-text-muted)]">
          No contacts yet. Add someone new or link an existing workspace
          contact.
        </p>
      )}

      {contacts.length > 0 && (
        <div className="overflow-hidden rounded-lg border border-[color:var(--workspace-shell-border)]">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-panel)]">
                <th className="w-12 px-2 py-2" />
                <th className="px-3 py-2 text-left text-xs font-medium text-[var(--workspace-shell-text-muted)]">
                  Name
                </th>
                <th className="hidden px-3 py-2 text-left text-xs font-medium text-[var(--workspace-shell-text-muted)] sm:table-cell">
                  Role
                </th>
                <th className="hidden px-3 py-2 text-left text-xs font-medium text-[var(--workspace-shell-text-muted)] md:table-cell">
                  Email
                </th>
                <th className="hidden px-3 py-2 text-left text-xs font-medium text-[var(--workspace-shell-text-muted)] md:table-cell">
                  Phone
                </th>
                {canEdit && <th className="w-8 px-2 py-2" />}
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-700">
              {contacts.map((contact) => (
                <tr
                  key={contact.id}
                  className="bg-[var(--workspace-shell-panel)] hover:bg-[var(--workspace-control-surface)]/50"
                >
                  <td className="px-2 py-2.5 align-middle">
                    <ContactImageUploader
                      accountId={accountId}
                      contactId={contact.id}
                      displayName={contact.full_name}
                      pictureUrl={contact.picture_url}
                      disabled={!canEdit}
                      onUpdated={fetchContacts}
                    />
                  </td>
                  <td className="px-3 py-2.5">
                    <div>
                      <p className="font-medium text-[var(--workspace-shell-text)]">
                        {contact.full_name}
                      </p>
                      {contact.is_primary && (
                        <span className="text-[10px] text-[var(--ozer-accent-muted)]">
                          Primary
                        </span>
                      )}
                      <div className="mt-0.5 flex flex-wrap gap-x-3 gap-y-0.5 sm:hidden">
                        {contact.role && (
                          <span className="text-[11px] text-[var(--workspace-shell-text-muted)]">
                            {formatContactRoleLabel(contact.role)}
                          </span>
                        )}
                        {contact.email && (
                          <a
                            href={`mailto:${contact.email}`}
                            className="flex items-center gap-1 text-[11px] text-[var(--workspace-shell-text-muted)] hover:text-[var(--ozer-accent-muted)]"
                          >
                            <Mail className="h-3 w-3" />
                            {contact.email}
                          </a>
                        )}
                        {contact.phone && (
                          <a
                            href={`tel:${contact.phone}`}
                            className="flex items-center gap-1 text-[11px] text-[var(--workspace-shell-text-muted)] hover:text-[var(--ozer-accent-muted)]"
                          >
                            <Phone className="h-3 w-3" />
                            {contact.phone}
                          </a>
                        )}
                      </div>
                    </div>
                  </td>
                  <td className="hidden px-3 py-2.5 text-xs text-[var(--workspace-shell-text-muted)] sm:table-cell">
                    {canEdit ? (
                      editingCustomRoleId === contact.id ? (
                        <div className="flex max-w-[12rem] flex-col gap-1">
                          <Input
                            value={customRoleDraft}
                            onChange={(e) => setCustomRoleDraft(e.target.value)}
                            placeholder="Custom role"
                            className="h-8 text-xs"
                            autoFocus
                          />
                          <div className="flex gap-1">
                            <Button
                              type="button"
                              size="sm"
                              className="h-7 px-2 text-xs"
                              onClick={() => {
                                void handleRoleChange(
                                  contact.id,
                                  customRoleDraft.trim(),
                                ).then(() => {
                                  setEditingCustomRoleId(null);
                                  setCustomRoleDraft('');
                                });
                              }}
                            >
                              Save
                            </Button>
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              className="h-7 px-2 text-xs"
                              onClick={() => {
                                setEditingCustomRoleId(null);
                                setCustomRoleDraft('');
                              }}
                            >
                              Cancel
                            </Button>
                          </div>
                        </div>
                      ) : (
                        <select
                          value={(() => {
                            const normalized =
                              normalizeContactRole(contact.role) ?? '';
                            return CONTACT_ROLE_PRESETS.includes(
                              normalized as ContactRolePreset,
                            ) || !normalized
                              ? normalized
                              : 'other';
                          })()}
                          onChange={(e) => {
                            const next = e.target.value;
                            if (next === 'other') {
                              setEditingCustomRoleId(contact.id);
                              setCustomRoleDraft(
                                contact.role &&
                                  !CONTACT_ROLE_PRESETS.includes(
                                    (normalizeContactRole(contact.role) ??
                                      '') as ContactRolePreset,
                                  )
                                  ? contact.role
                                  : '',
                              );
                              return;
                            }
                            void handleRoleChange(contact.id, next);
                          }}
                          className="border-input bg-background h-8 max-w-[9rem] rounded-md border px-2 text-xs"
                        >
                          <option value="">—</option>
                          {CONTACT_ROLE_PRESETS.map((role) => (
                            <option key={role} value={role}>
                              {CONTACT_ROLE_LABELS[role]}
                            </option>
                          ))}
                        </select>
                      )
                    ) : (
                      formatContactRoleLabel(contact.role)
                    )}
                  </td>
                  <td className="hidden px-3 py-2.5 md:table-cell">
                    {contact.email ? (
                      <a
                        href={`mailto:${contact.email}`}
                        className="flex items-center gap-1 text-xs text-[var(--workspace-shell-text-muted)] hover:text-[var(--ozer-accent-muted)]"
                      >
                        <Mail className="h-3 w-3" />
                        {contact.email}
                      </a>
                    ) : (
                      <span className="text-xs text-[var(--workspace-shell-text-muted)]">
                        —
                      </span>
                    )}
                  </td>
                  <td className="hidden px-3 py-2.5 md:table-cell">
                    {contact.phone ? (
                      <a
                        href={`tel:${contact.phone}`}
                        className="flex items-center gap-1 text-xs text-[var(--workspace-shell-text-muted)] hover:text-[var(--ozer-accent-muted)]"
                      >
                        <Phone className="h-3 w-3" />
                        {contact.phone}
                      </a>
                    ) : (
                      <span className="text-xs text-[var(--workspace-shell-text-muted)]">
                        —
                      </span>
                    )}
                  </td>
                  {canEdit && (
                    <td className="px-2 py-2.5">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 text-[var(--workspace-shell-text-muted)] hover:text-[var(--workspace-shell-text)]"
                          >
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-48">
                          <DropdownMenuItem
                            onClick={() => {
                              setShowAddForm(false);
                              setEditingContactId(contact.id);
                            }}
                          >
                            <Pencil className="mr-2 h-4 w-4" />
                            Edit
                          </DropdownMenuItem>
                          {!contact.is_primary && (
                            <DropdownMenuItem
                              onClick={() => handleSetPrimary(contact.id)}
                            >
                              <Star className="mr-2 h-4 w-4" />
                              Make primary
                            </DropdownMenuItem>
                          )}
                          <DropdownMenuItem
                            className="text-red-400 focus:text-red-400"
                            onClick={() => handleDelete(contact.id)}
                          >
                            <Trash2 className="mr-2 h-4 w-4" />
                            Remove from client
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {editingContactId &&
        (() => {
          const editing = contacts.find((c) => c.id === editingContactId);
          if (!editing) return null;
          return (
            <EditContactForm
              key={editing.id}
              accountId={accountId}
              clientId={clientId}
              contact={editing}
              onSaved={() => {
                setEditingContactId(null);
                fetchContacts();
              }}
              onCancel={() => setEditingContactId(null)}
            />
          );
        })()}

      {showAddForm && (
        <AddContactForm
          accountId={accountId}
          clientId={clientId}
          onAdded={() => {
            setShowAddForm(false);
            fetchContacts();
          }}
          onCancel={() => setShowAddForm(false)}
        />
      )}

      {canEdit && !showAddForm && !editingContactId && (
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="border-[color:var(--workspace-shell-border)] text-[var(--workspace-shell-text-muted)] hover:bg-[var(--workspace-control-surface)] hover:text-[var(--workspace-shell-text)]"
            onClick={() => {
              setEditingContactId(null);
              setShowAddForm(true);
            }}
          >
            <PlusCircle className="mr-2 h-4 w-4" />
            Add contact
          </Button>
        </div>
      )}
    </div>
  );
}
