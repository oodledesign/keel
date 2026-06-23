'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';

import { Check, ChevronsUpDown, Mail, MoreHorizontal, Phone, PlusCircle, Trash2 } from 'lucide-react';

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
  createContact,
  deleteContact,
  linkContact,
  listAccountContacts,
  listContacts,
} from '../_lib/server/server-actions';

type Contact = {
  id: string;
  full_name: string;
  email: string | null;
  phone: string | null;
  role: string | null;
  is_primary: boolean;
};

type AccountContact = {
  id: string;
  full_name: string;
  email: string | null;
  phone: string | null;
};

type AddMode = 'new' | 'existing';

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
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [role, setRole] = useState('');
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
    if (!fullName.trim()) {
      toast.error('Name is required');
      return;
    }
    setSaving(true);
    try {
      await createContact({
        accountId,
        clientId,
        fullName: fullName.trim(),
        email: email.trim() || undefined,
        phone: phone.trim() || undefined,
        role: role.trim() || undefined,
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
    <div className="space-y-3 rounded-lg border border-zinc-700 bg-zinc-900 p-4">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm font-medium text-white">Add contact</p>
        <div className="flex rounded-md border border-zinc-700 p-0.5 text-xs">
          <button
            type="button"
            onClick={() => setMode('new')}
            className={cn(
              'rounded px-2 py-1',
              mode === 'new' ? 'bg-zinc-700 text-white' : 'text-zinc-400 hover:text-white',
            )}
          >
            New
          </button>
          <button
            type="button"
            onClick={() => setMode('existing')}
            className={cn(
              'rounded px-2 py-1',
              mode === 'existing' ? 'bg-zinc-700 text-white' : 'text-zinc-400 hover:text-white',
            )}
          >
            Existing
          </button>
        </div>
      </div>

      {mode === 'new' ? (
        <form onSubmit={handleCreate} className="space-y-3">
          <div className="space-y-2">
            <Label htmlFor="contact_full_name" className="text-xs">Name *</Label>
            <Input
              id="contact_full_name"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="e.g. Jane Smith"
              className="h-8 text-sm"
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="contact_role" className="text-xs">Role</Label>
            <Input
              id="contact_role"
              value={role}
              onChange={(e) => setRole(e.target.value)}
              placeholder="e.g. CEO, Account Manager"
              className="h-8 text-sm"
            />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-2">
              <Label htmlFor="contact_email" className="text-xs">Email</Label>
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
              <Label htmlFor="contact_phone" className="text-xs">Phone</Label>
              <Input
                id="contact_phone"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="Phone number"
                className="h-8 text-sm"
              />
            </div>
          </div>
          <div className="flex gap-2 pt-1">
            <Button type="submit" size="sm" disabled={saving}>
              {saving ? 'Adding…' : 'Add contact'}
            </Button>
            <Button type="button" size="sm" variant="outline" onClick={onCancel}>
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
                    'w-full justify-between border-zinc-600 bg-zinc-800 text-white hover:bg-zinc-700 hover:text-white',
                    !selectedContact && 'text-zinc-500',
                  )}
                >
                  {selectedContact
                    ? `${selectedContact.full_name}${selectedContact.email ? ` · ${selectedContact.email}` : ''}`
                    : 'Search workspace contacts…'}
                  <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent
                className="w-[var(--radix-popover-trigger-width)] border-zinc-700 bg-zinc-900 p-0"
                align="start"
              >
                <Command className="bg-zinc-900" shouldFilter={false}>
                  <CommandInput
                    placeholder="Search by name or email…"
                    value={searchQuery}
                    onValueChange={setSearchQuery}
                    className="border-zinc-700 bg-zinc-800 text-white placeholder:text-zinc-500"
                  />
                  <CommandList>
                    <CommandEmpty>
                      {loadingContacts ? 'Searching…' : 'No contacts found in this workspace.'}
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
                            className="text-zinc-300 aria-selected:bg-zinc-800"
                          >
                            <Check
                              className={cn(
                                'mr-2 h-4 w-4',
                                selectedContactId === contact.id ? 'opacity-100' : 'opacity-0',
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
          <div className="space-y-2">
            <Label htmlFor="link_role" className="text-xs">Role on this client</Label>
            <Input
              id="link_role"
              value={role}
              onChange={(e) => setRole(e.target.value)}
              placeholder="e.g. Finance contact"
              className="h-8 text-sm"
            />
          </div>
          <div className="flex gap-2 pt-1">
            <Button type="submit" size="sm" disabled={saving || !selectedContactId}>
              {saving ? 'Linking…' : 'Link contact'}
            </Button>
            <Button type="button" size="sm" variant="outline" onClick={onCancel}>
              Cancel
            </Button>
          </div>
        </form>
      )}
    </div>
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

  const fetchContacts = useCallback(async () => {
    setLoading(true);
    try {
      const result = (await listContacts({ clientId })) as { data: Contact[] };
      setContacts(Array.isArray(result?.data) ? result.data : []);
    } catch {
      setContacts([]);
    } finally {
      setLoading(false);
    }
  }, [clientId]);

  useEffect(() => {
    fetchContacts();
  }, [fetchContacts]);

  const handleDelete = async (contactId: string) => {
    if (!confirm('Remove this contact from this client?')) return;
    try {
      await deleteContact({ clientId, contactId });
      toast.success('Contact removed from this client');
      fetchContacts();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to remove contact');
    }
  };

  if (loading) {
    return <p className="text-xs text-zinc-500">Loading contacts…</p>;
  }

  return (
    <div className="space-y-3">
      {contacts.length === 0 && !showAddForm && (
        <p className="text-xs text-zinc-500">
          No contacts yet. Add someone new or link an existing workspace contact.
        </p>
      )}

      {contacts.length > 0 && (
        <div className="overflow-hidden rounded-lg border border-zinc-700">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-zinc-700 bg-zinc-900">
                <th className="px-3 py-2 text-left text-xs font-medium text-zinc-400">Name</th>
                <th className="hidden px-3 py-2 text-left text-xs font-medium text-zinc-400 sm:table-cell">Role</th>
                <th className="hidden px-3 py-2 text-left text-xs font-medium text-zinc-400 md:table-cell">Email</th>
                <th className="hidden px-3 py-2 text-left text-xs font-medium text-zinc-400 md:table-cell">Phone</th>
                {canEdit && <th className="w-8 px-2 py-2" />}
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-700">
              {contacts.map((contact) => (
                <tr key={contact.id} className="bg-[var(--workspace-shell-panel)] hover:bg-zinc-800/50">
                  <td className="px-3 py-2.5">
                    <div>
                      <p className="font-medium text-white">{contact.full_name}</p>
                      {contact.is_primary && (
                        <span className="text-[10px] text-[#5eead4]">Primary</span>
                      )}
                      <div className="mt-0.5 flex flex-wrap gap-x-3 gap-y-0.5 sm:hidden">
                        {contact.role && (
                          <span className="text-[11px] text-zinc-500">{contact.role}</span>
                        )}
                        {contact.email && (
                          <a href={`mailto:${contact.email}`} className="flex items-center gap-1 text-[11px] text-zinc-400 hover:text-[#5eead4]">
                            <Mail className="h-3 w-3" />{contact.email}
                          </a>
                        )}
                        {contact.phone && (
                          <a href={`tel:${contact.phone}`} className="flex items-center gap-1 text-[11px] text-zinc-400 hover:text-[#5eead4]">
                            <Phone className="h-3 w-3" />{contact.phone}
                          </a>
                        )}
                      </div>
                    </div>
                  </td>
                  <td className="hidden px-3 py-2.5 text-xs text-zinc-400 sm:table-cell">
                    {contact.role ?? '—'}
                  </td>
                  <td className="hidden px-3 py-2.5 md:table-cell">
                    {contact.email ? (
                      <a href={`mailto:${contact.email}`} className="flex items-center gap-1 text-xs text-zinc-400 hover:text-[#5eead4]">
                        <Mail className="h-3 w-3" />{contact.email}
                      </a>
                    ) : (
                      <span className="text-xs text-zinc-600">—</span>
                    )}
                  </td>
                  <td className="hidden px-3 py-2.5 md:table-cell">
                    {contact.phone ? (
                      <a href={`tel:${contact.phone}`} className="flex items-center gap-1 text-xs text-zinc-400 hover:text-[#5eead4]">
                        <Phone className="h-3 w-3" />{contact.phone}
                      </a>
                    ) : (
                      <span className="text-xs text-zinc-600">—</span>
                    )}
                  </td>
                  {canEdit && (
                    <td className="px-2 py-2.5">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-7 w-7 text-zinc-500 hover:text-white">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-48">
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

      {canEdit && !showAddForm && (
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="border-zinc-700 text-zinc-400 hover:bg-zinc-800 hover:text-white"
            onClick={() => setShowAddForm(true)}
          >
            <PlusCircle className="mr-2 h-4 w-4" />
            Add contact
          </Button>
        </div>
      )}
    </div>
  );
}
