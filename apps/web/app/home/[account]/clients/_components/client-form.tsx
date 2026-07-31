'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';

import { Building2, Check, ChevronsUpDown, User } from 'lucide-react';

import { Button } from '@kit/ui/button';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@kit/ui/command';
import { Input } from '@kit/ui/input';
import { Label } from '@kit/ui/label';
import { Popover, PopoverContent, PopoverTrigger } from '@kit/ui/popover';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@kit/ui/select';
import { toast } from '@kit/ui/sonner';
import { cn } from '@kit/ui/utils';

import {
  CONTACT_ROLE_LABELS,
  CONTACT_ROLE_PRESETS,
  type ContactRolePreset,
} from '~/lib/clients/contact-roles';
import {
  COMMERCIAL_CLIENT_ROLES,
  COMMERCIAL_CLIENT_ROLE_LABELS,
  type CommercialClientRole,
} from '~/lib/commercial/commercial-constants';

import {
  createClient,
  deleteClient,
  listWorkspaceContacts,
  updateClient,
} from '../_lib/server/server-actions';

type Client = {
  id: string;
  account_id: string;
  client_type?: string | null;
  first_name: string | null;
  last_name: string | null;
  display_name: string | null;
  company_name: string | null;
  email: string | null;
  phone: string | null;
  website?: string | null;
  address_line_1: string | null;
  address_line_2: string | null;
  city: string | null;
  postcode: string | null;
  country: string | null;
  picture_url: string | null;
  commercial_role?: CommercialClientRole | null;
};

export type CreateInitialValues = {
  first_name?: string;
  company_name?: string;
};

type ClientType = 'individual' | 'business';
type PrimaryContactMode = 'new' | 'existing';

type WorkspaceContactOption = {
  id: string;
  full_name: string;
  email: string | null;
  phone: string | null;
};

export function ClientForm({
  accountId,
  accountSlug,
  mode,
  client,
  initialValues,
  canEdit = true,
  showCommercialRole = false,
  onSaved,
  onDeleted,
  onCancel,
}: {
  accountId: string;
  accountSlug?: string;
  mode: 'create' | 'edit';
  client?: Client | null;
  initialValues?: CreateInitialValues;
  canEdit?: boolean;
  showCommercialRole?: boolean;
  onSaved: () => void;
  onDeleted?: () => void;
  onCancel?: () => void;
}) {
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const inferredType: ClientType =
    (client?.client_type as ClientType | undefined) ??
    (initialValues?.company_name ? 'business' : 'individual');

  const [clientType, setClientType] = useState<ClientType>(
    mode === 'edit' ? inferredType : 'business',
  );

  const [first_name, setFirstName] = useState(
    mode === 'create' && initialValues?.first_name !== undefined
      ? initialValues.first_name
      : (client?.first_name ?? ''),
  );
  const [last_name, setLastName] = useState(client?.last_name ?? '');
  const [company_name, setCompanyName] = useState(
    mode === 'create' && initialValues?.company_name !== undefined
      ? initialValues.company_name
      : (client?.company_name ?? ''),
  );
  const [email, setEmail] = useState(client?.email ?? '');
  const [phone, setPhone] = useState(client?.phone ?? '');
  const [website, setWebsite] = useState(client?.website ?? '');
  const [address_line_1, setAddressLine1] = useState(
    client?.address_line_1 ?? '',
  );
  const [address_line_2, setAddressLine2] = useState(
    client?.address_line_2 ?? '',
  );
  const [city, setCity] = useState(client?.city ?? '');
  const [postcode, setPostcode] = useState(client?.postcode ?? '');
  const [country, setCountry] = useState(client?.country ?? '');
  const [commercialRole, setCommercialRole] = useState<
    CommercialClientRole | ''
  >(client?.commercial_role ?? '');

  const [contactMode, setContactMode] = useState<PrimaryContactMode>('new');
  const [contactFirstName, setContactFirstName] = useState('');
  const [contactLastName, setContactLastName] = useState('');
  const [contactEmail, setContactEmail] = useState('');
  const [contactPhone, setContactPhone] = useState('');
  const [contactRole, setContactRole] = useState<ContactRolePreset | ''>(
    'founder',
  );
  const [selectedContactId, setSelectedContactId] = useState('');
  const [workspaceContacts, setWorkspaceContacts] = useState<
    WorkspaceContactOption[]
  >([]);
  const [loadingContacts, setLoadingContacts] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const isReadOnly = mode === 'edit' && !canEdit;
  const isIndividual = clientType === 'individual';
  const showCreateContact = mode === 'create' && !isIndividual;

  const loadWorkspaceContacts = useCallback(async () => {
    setLoadingContacts(true);
    try {
      const result = (await listWorkspaceContacts({
        accountId,
      })) as { data?: WorkspaceContactOption[] };
      setWorkspaceContacts(Array.isArray(result?.data) ? result.data : []);
    } catch {
      setWorkspaceContacts([]);
    } finally {
      setLoadingContacts(false);
    }
  }, [accountId]);

  useEffect(() => {
    if (!showCreateContact || contactMode !== 'existing') return;
    void loadWorkspaceContacts();
  }, [contactMode, loadWorkspaceContacts, showCreateContact]);

  const filteredContacts = useMemo(() => {
    const search = searchQuery.trim().toLowerCase();
    if (!search) return workspaceContacts;
    return workspaceContacts.filter((contact) => {
      const name = contact.full_name?.toLowerCase() ?? '';
      const contactEmailValue = contact.email?.toLowerCase() ?? '';
      return name.includes(search) || contactEmailValue.includes(search);
    });
  }, [searchQuery, workspaceContacts]);

  const selectedContact = useMemo(
    () =>
      workspaceContacts.find((contact) => contact.id === selectedContactId) ??
      null,
    [selectedContactId, workspaceContacts],
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isIndividual && !first_name.trim()) {
      toast.error('First name is required');
      return;
    }
    if (!isIndividual && !company_name.trim()) {
      toast.error('Company name is required for a business client');
      return;
    }
    if (
      showCreateContact &&
      contactMode === 'new' &&
      !contactFirstName.trim()
    ) {
      toast.error('Add a primary contact with a first name');
      return;
    }
    if (showCreateContact && contactMode === 'existing' && !selectedContactId) {
      toast.error('Select an existing contact as the primary');
      return;
    }
    setSaving(true);
    try {
      if (mode === 'create') {
        await createClient({
          accountId,
          client_type: clientType,
          first_name: isIndividual ? first_name.trim() : undefined,
          last_name: isIndividual ? last_name.trim() || undefined : undefined,
          company_name: isIndividual
            ? undefined
            : company_name.trim() || undefined,
          email: isIndividual
            ? email.trim() || undefined
            : contactMode === 'new'
              ? contactEmail.trim() || email.trim() || undefined
              : selectedContact?.email || email.trim() || undefined,
          phone: isIndividual
            ? phone.trim() || undefined
            : contactMode === 'new'
              ? contactPhone.trim() || phone.trim() || undefined
              : selectedContact?.phone || phone.trim() || undefined,
          website: website.trim() || undefined,
          address_line_1: address_line_1.trim() || undefined,
          address_line_2: address_line_2.trim() || undefined,
          city: city.trim() || undefined,
          postcode: postcode.trim() || undefined,
          country: country.trim() || undefined,
          commercial_role: showCommercialRole
            ? commercialRole || null
            : undefined,
          contact:
            showCreateContact && contactMode === 'new'
              ? {
                  firstName: contactFirstName.trim(),
                  lastName: contactLastName.trim() || undefined,
                  email: contactEmail.trim() || undefined,
                  phone: contactPhone.trim() || undefined,
                  role: contactRole || undefined,
                  isPrimary: true,
                }
              : undefined,
          existingContactId:
            showCreateContact && contactMode === 'existing'
              ? selectedContactId
              : undefined,
          existingContactRole:
            showCreateContact && contactMode === 'existing'
              ? contactRole || undefined
              : undefined,
        });
        toast.success(
          isIndividual
            ? 'Individual client created'
            : 'Business client created',
        );
        onSaved();
      } else if (client) {
        await updateClient({
          accountId,
          clientId: client.id,
          accountSlug,
          client_type: clientType,
          first_name: isIndividual ? first_name.trim() : null,
          last_name: isIndividual ? last_name.trim() || null : null,
          company_name: isIndividual ? null : company_name.trim() || null,
          email: email.trim() || null,
          phone: phone.trim() || null,
          website: website.trim() || null,
          address_line_1: address_line_1.trim() || null,
          address_line_2: address_line_2.trim() || null,
          city: city.trim() || null,
          postcode: postcode.trim() || null,
          country: country.trim() || null,
          commercial_role: showCommercialRole
            ? commercialRole || null
            : undefined,
        });
        toast.success('Client updated');
        onSaved();
      }
    } catch (e) {
      const message =
        e instanceof Error
          ? e.message
          : typeof (e as { message?: string })?.message === 'string'
            ? (e as { message: string }).message
            : 'Failed to save';
      toast.error(message);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (
      !client ||
      !onDeleted ||
      !confirm('Delete this client? This cannot be undone.')
    )
      return;
    setDeleting(true);
    try {
      await deleteClient({ accountId, clientId: client.id });
      toast.success('Client deleted');
      onDeleted();
    } catch (e) {
      const message =
        e instanceof Error
          ? e.message
          : typeof (e as { message?: string })?.message === 'string'
            ? (e as { message: string }).message
            : 'Failed to delete';
      toast.error(message);
    } finally {
      setDeleting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div className="space-y-2">
        <Label>Client type</Label>
        <div className="flex overflow-hidden rounded-lg border border-[color:var(--workspace-shell-border)]">
          <button
            type="button"
            onClick={() => !isReadOnly && setClientType('individual')}
            disabled={isReadOnly}
            className={`flex flex-1 items-center justify-center gap-2 px-4 py-2.5 text-sm font-medium transition-colors ${
              isIndividual
                ? 'bg-[var(--ozer-accent)] text-[var(--ozer-white)]'
                : 'bg-[var(--workspace-control-surface)] text-[var(--workspace-shell-text-muted)] hover:bg-[var(--workspace-shell-panel-hover)] hover:text-[var(--workspace-shell-text)]'
            }`}
          >
            <User className="h-4 w-4" />
            Individual
          </button>
          <button
            type="button"
            onClick={() => !isReadOnly && setClientType('business')}
            disabled={isReadOnly}
            className={`flex flex-1 items-center justify-center gap-2 border-l border-[color:var(--workspace-shell-border)] px-4 py-2.5 text-sm font-medium transition-colors ${
              !isIndividual
                ? 'bg-[var(--ozer-accent)] text-[var(--ozer-white)]'
                : 'bg-[var(--workspace-control-surface)] text-[var(--workspace-shell-text-muted)] hover:bg-[var(--workspace-shell-panel-hover)] hover:text-[var(--workspace-shell-text)]'
            }`}
          >
            <Building2 className="h-4 w-4" />
            Business
          </button>
        </div>
        {isIndividual ? (
          <p className="text-xs text-[var(--workspace-shell-text-muted)]">
            A single person. Their name and email are also their contact record.
          </p>
        ) : (
          <p className="text-xs text-[var(--workspace-shell-text-muted)]">
            A company. Add people on the Contacts tab (primary, finance, etc.).
          </p>
        )}
      </div>

      {showCommercialRole ? (
        <div className="space-y-2">
          <Label>Commercial role</Label>
          <Select
            value={commercialRole || 'none'}
            onValueChange={(value) =>
              setCommercialRole(
                value === 'none' ? '' : (value as CommercialClientRole),
              )
            }
            disabled={isReadOnly}
          >
            <SelectTrigger>
              <SelectValue placeholder="Select role" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">None</SelectItem>
              {COMMERCIAL_CLIENT_ROLES.map((role) => (
                <SelectItem key={role} value={role}>
                  {COMMERCIAL_CLIENT_ROLE_LABELS[role]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      ) : null}

      {!isIndividual && (
        <div className="space-y-2">
          <Label htmlFor="company_name">Company name *</Label>
          <Input
            id="company_name"
            value={company_name}
            onChange={(e) => setCompanyName(e.target.value)}
            placeholder="e.g. Acme Ltd"
            required
            readOnly={isReadOnly}
          />
        </div>
      )}

      {isIndividual && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="first_name">First name *</Label>
            <Input
              id="first_name"
              value={first_name}
              onChange={(e) => setFirstName(e.target.value)}
              placeholder="e.g. First name"
              required
              readOnly={isReadOnly}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="last_name">Last name</Label>
            <Input
              id="last_name"
              value={last_name}
              onChange={(e) => setLastName(e.target.value)}
              placeholder="e.g. Last name"
              readOnly={isReadOnly}
            />
          </div>
        </div>
      )}

      {showCreateContact && (
        <div className="space-y-3 rounded-lg border border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-panel)] p-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-sm font-medium text-[var(--workspace-shell-text)]">
                Primary contact *
              </p>
              <p className="text-xs text-[var(--workspace-shell-text-muted)]">
                Used for proposals, contracts, and notifications. Mark someone
                as Finance later for invoice emails.
              </p>
            </div>
            <div className="flex shrink-0 rounded-md border border-[color:var(--workspace-shell-border)] p-0.5 text-xs">
              <button
                type="button"
                onClick={() => setContactMode('new')}
                className={cn(
                  'rounded px-2 py-1',
                  contactMode === 'new'
                    ? 'bg-[var(--workspace-shell-panel-hover)] text-[var(--workspace-shell-text)]'
                    : 'text-[var(--workspace-shell-text-muted)] hover:text-[var(--workspace-shell-text)]',
                )}
              >
                New
              </button>
              <button
                type="button"
                onClick={() => setContactMode('existing')}
                className={cn(
                  'rounded px-2 py-1',
                  contactMode === 'existing'
                    ? 'bg-[var(--workspace-shell-panel-hover)] text-[var(--workspace-shell-text)]'
                    : 'text-[var(--workspace-shell-text-muted)] hover:text-[var(--workspace-shell-text)]',
                )}
              >
                Existing
              </button>
            </div>
          </div>

          {contactMode === 'new' ? (
            <>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="contact_first_name" className="text-xs">
                    First name *
                  </Label>
                  <Input
                    id="contact_first_name"
                    value={contactFirstName}
                    onChange={(e) => setContactFirstName(e.target.value)}
                    placeholder="e.g. First name"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="contact_last_name" className="text-xs">
                    Last name
                  </Label>
                  <Input
                    id="contact_last_name"
                    value={contactLastName}
                    onChange={(e) => setContactLastName(e.target.value)}
                    placeholder="e.g. Last name"
                  />
                </div>
              </div>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="contact_email" className="text-xs">
                    Email
                  </Label>
                  <Input
                    id="contact_email"
                    type="email"
                    value={contactEmail}
                    onChange={(e) => setContactEmail(e.target.value)}
                    placeholder="name@company.com"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="contact_phone" className="text-xs">
                    Phone
                  </Label>
                  <Input
                    id="contact_phone"
                    value={contactPhone}
                    onChange={(e) => setContactPhone(e.target.value)}
                    placeholder="Phone number"
                  />
                </div>
              </div>
            </>
          ) : (
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
                    className="bg-[var(--workspace-shell-panel)] text-[var(--workspace-shell-text)]"
                    shouldFilter={false}
                  >
                    <CommandInput
                      placeholder="Search by name or email…"
                      value={searchQuery}
                      onValueChange={setSearchQuery}
                      className="border-[color:var(--workspace-shell-border)] bg-[var(--workspace-control-surface)] text-[var(--workspace-shell-text)] placeholder:text-[var(--workspace-shell-text-muted)]"
                    />
                    <CommandList>
                      <CommandEmpty className="text-[var(--workspace-shell-text-muted)]">
                        {loadingContacts
                          ? 'Searching…'
                          : 'No contacts found in this workspace.'}
                      </CommandEmpty>
                      <CommandGroup>
                        {filteredContacts.map((contact) => {
                          const label = `${contact.full_name}${contact.email ? ` · ${contact.email}` : ''}`;
                          return (
                            <CommandItem
                              key={contact.id}
                              value={label}
                              onSelect={() => {
                                setSelectedContactId(contact.id);
                                setSearchOpen(false);
                              }}
                              className="text-[var(--workspace-shell-text)] aria-selected:bg-[var(--workspace-shell-panel-hover)] aria-selected:text-[var(--workspace-shell-text)]"
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
          )}

          <div className="space-y-2">
            <Label htmlFor="contact_role" className="text-xs">
              Role
            </Label>
            <select
              id="contact_role"
              value={contactRole}
              onChange={(e) =>
                setContactRole(e.target.value as ContactRolePreset | '')
              }
              className="border-input bg-background h-9 w-full rounded-md border px-3 text-sm"
            >
              <option value="">Select role…</option>
              {CONTACT_ROLE_PRESETS.map((role) => (
                <option key={role} value={role}>
                  {CONTACT_ROLE_LABELS[role]}
                </option>
              ))}
            </select>
          </div>
        </div>
      )}

      {(isIndividual || mode === 'edit') && (
        <div className="space-y-2">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="email">
                {isIndividual ? 'Email' : 'Fallback email'}
              </Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="email@example.com"
                readOnly={isReadOnly}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="phone">
                {isIndividual ? 'Phone' : 'Fallback phone'}
              </Label>
              <Input
                id="phone"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="Phone number"
                readOnly={isReadOnly}
              />
            </div>
          </div>
          {!isIndividual ? (
            <p className="text-xs text-[var(--workspace-shell-text-muted)]">
              Optional. Prefer contact emails on the Contacts tab for proposals
              and invoices.
            </p>
          ) : (
            <p className="text-xs text-[var(--workspace-shell-text-muted)]">
              Saved as this person&apos;s contact details too.
            </p>
          )}
        </div>
      )}

      <div className="space-y-2">
        <Label htmlFor="website">Website</Label>
        <Input
          id="website"
          value={website}
          onChange={(e) => setWebsite(e.target.value)}
          placeholder="acme.com"
          readOnly={isReadOnly}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="address_line_1">Address line 1</Label>
        <Input
          id="address_line_1"
          value={address_line_1}
          onChange={(e) => setAddressLine1(e.target.value)}
          placeholder="Street address"
          readOnly={isReadOnly}
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="address_line_2">Address line 2</Label>
        <Input
          id="address_line_2"
          value={address_line_2}
          onChange={(e) => setAddressLine2(e.target.value)}
          placeholder="Apartment, suite, etc."
          readOnly={isReadOnly}
        />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="city">City</Label>
          <Input
            id="city"
            value={city}
            onChange={(e) => setCity(e.target.value)}
            readOnly={isReadOnly}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="postcode">Postcode</Label>
          <Input
            id="postcode"
            value={postcode}
            onChange={(e) => setPostcode(e.target.value)}
            readOnly={isReadOnly}
          />
        </div>
      </div>
      <div className="space-y-2">
        <Label htmlFor="country">Country</Label>
        <Input
          id="country"
          value={country}
          onChange={(e) => setCountry(e.target.value)}
          readOnly={isReadOnly}
        />
      </div>

      <div className="flex flex-wrap gap-2 pt-2">
        {!isReadOnly && (
          <Button type="submit" disabled={saving}>
            {saving
              ? 'Saving...'
              : mode === 'create'
                ? 'Create client'
                : 'Save changes'}
          </Button>
        )}
        {onCancel && (
          <Button type="button" variant="outline" onClick={onCancel}>
            Cancel
          </Button>
        )}
        {mode === 'edit' && canEdit && onDeleted && (
          <Button
            type="button"
            variant="destructive"
            onClick={handleDelete}
            disabled={deleting}
          >
            {deleting ? 'Deleting...' : 'Delete client'}
          </Button>
        )}
      </div>
    </form>
  );
}
