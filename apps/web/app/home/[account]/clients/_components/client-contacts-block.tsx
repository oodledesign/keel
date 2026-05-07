'use client';

import { useCallback, useEffect, useState } from 'react';

import { Mail, MoreHorizontal, Phone, PlusCircle, Trash2 } from 'lucide-react';

import { Button } from '@kit/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@kit/ui/dropdown-menu';
import { Input } from '@kit/ui/input';
import { Label } from '@kit/ui/label';
import { toast } from '@kit/ui/sonner';

import {
  createContact,
  deleteContact,
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

function AddContactForm({
  clientId,
  userId,
  onAdded,
  onCancel,
}: {
  clientId: string;
  userId: string;
  onAdded: () => void;
  onCancel: () => void;
}) {
  const [saving, setSaving] = useState(false);
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [role, setRole] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fullName.trim()) {
      toast.error('Name is required');
      return;
    }
    setSaving(true);
    try {
      await createContact({
        clientId,
        userId,
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

  return (
    <form onSubmit={handleSubmit} className="space-y-3 rounded-lg border border-zinc-700 bg-zinc-900 p-4">
      <p className="text-sm font-medium text-white">Add contact</p>
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
  );
}

export function ClientContactsBlock({
  clientId,
  userId,
  canEdit,
}: {
  clientId: string;
  userId: string;
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
    if (!confirm('Remove this contact?')) return;
    try {
      await deleteContact({ contactId });
      toast.success('Contact removed');
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
        <p className="text-xs text-zinc-500">No contacts yet. Add the first contact for this business.</p>
      )}

      {/* Contacts table */}
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
                        <span className="text-[10px] text-emerald-400">Primary</span>
                      )}
                      {/* Mobile: show role/email/phone inline */}
                      <div className="mt-0.5 flex flex-wrap gap-x-3 gap-y-0.5 sm:hidden">
                        {contact.role && (
                          <span className="text-[11px] text-zinc-500">{contact.role}</span>
                        )}
                        {contact.email && (
                          <a href={`mailto:${contact.email}`} className="flex items-center gap-1 text-[11px] text-zinc-400 hover:text-emerald-400">
                            <Mail className="h-3 w-3" />{contact.email}
                          </a>
                        )}
                        {contact.phone && (
                          <a href={`tel:${contact.phone}`} className="flex items-center gap-1 text-[11px] text-zinc-400 hover:text-emerald-400">
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
                      <a href={`mailto:${contact.email}`} className="flex items-center gap-1 text-xs text-zinc-400 hover:text-emerald-400">
                        <Mail className="h-3 w-3" />{contact.email}
                      </a>
                    ) : (
                      <span className="text-xs text-zinc-600">—</span>
                    )}
                  </td>
                  <td className="hidden px-3 py-2.5 md:table-cell">
                    {contact.phone ? (
                      <a href={`tel:${contact.phone}`} className="flex items-center gap-1 text-xs text-zinc-400 hover:text-emerald-400">
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
                        <DropdownMenuContent align="end" className="w-40">
                          <DropdownMenuItem
                            className="text-red-400 focus:text-red-400"
                            onClick={() => handleDelete(contact.id)}
                          >
                            <Trash2 className="mr-2 h-4 w-4" />
                            Remove
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

      {/* Add contact form */}
      {showAddForm && (
        <AddContactForm
          clientId={clientId}
          userId={userId}
          onAdded={() => {
            setShowAddForm(false);
            fetchContacts();
          }}
          onCancel={() => setShowAddForm(false)}
        />
      )}

      {canEdit && !showAddForm && (
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
      )}
    </div>
  );
}
