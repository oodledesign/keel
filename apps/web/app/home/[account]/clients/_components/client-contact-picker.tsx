'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

import { Plus } from 'lucide-react';

import { Button } from '@kit/ui/button';
import { Input } from '@kit/ui/input';
import { Label } from '@kit/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@kit/ui/select';

import { workspaceBtnPrimaryMd } from '~/lib/workspace-ui';

import { ClientCombobox } from '../../jobs/_components/client-combobox';
import {
  createClient,
  createContact,
  listClients,
  listContacts,
} from '../_lib/server/server-actions';

export type ClientContactPickerClient = {
  id: string;
  display_name: string | null;
  company_name?: string | null;
  client_type?: string | null;
  email?: string | null;
  phone?: string | null;
  first_name?: string | null;
  last_name?: string | null;
};

export type ClientContactPickerContact = {
  id: string;
  full_name: string;
  email: string | null;
  phone: string | null;
  is_primary?: boolean;
};

export type ClientContactPickerValue = {
  clientId: string;
  contactId: string;
  companyName: string;
  contactName: string;
  contactEmail: string;
  contactPhone: string;
};

export function emptyClientContactPickerValue(): ClientContactPickerValue {
  return {
    clientId: '',
    contactId: '',
    companyName: '',
    contactName: '',
    contactEmail: '',
    contactPhone: '',
  };
}

function clientLabel(client: ClientContactPickerClient) {
  return (
    client.display_name ||
    client.company_name ||
    [client.first_name, client.last_name].filter(Boolean).join(' ') ||
    client.id
  );
}

const inputClass =
  'border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-sidebar-accent)] text-[var(--workspace-shell-text)] placeholder:text-[var(--workspace-shell-text)]/30';

interface ClientContactPickerProps {
  accountId: string;
  /** When false, resets create panels and skips loading. */
  active: boolean;
  value: ClientContactPickerValue;
  onChange: (value: ClientContactPickerValue) => void;
  onError?: (message: string | null) => void;
  showSummary?: boolean;
  allowNone?: boolean;
}

export function ClientContactPicker({
  accountId,
  active,
  value,
  onChange,
  onError,
  showSummary = false,
  allowNone = true,
}: ClientContactPickerProps) {
  const [clients, setClients] = useState<ClientContactPickerClient[]>([]);
  const [clientsLoading, setClientsLoading] = useState(false);
  const [contacts, setContacts] = useState<ClientContactPickerContact[]>([]);
  const [contactsLoading, setContactsLoading] = useState(false);

  const [showNewClient, setShowNewClient] = useState(false);
  const [creatingClient, setCreatingClient] = useState(false);
  const [newClientType, setNewClientType] = useState<'business' | 'individual'>(
    'business',
  );
  const [newCompanyName, setNewCompanyName] = useState('');
  const [newFirstName, setNewFirstName] = useState('');
  const [newLastName, setNewLastName] = useState('');
  const [newClientEmail, setNewClientEmail] = useState('');
  const [newClientPhone, setNewClientPhone] = useState('');

  const [showNewContact, setShowNewContact] = useState(false);
  const [creatingContact, setCreatingContact] = useState(false);
  const [newContactFirstName, setNewContactFirstName] = useState('');
  const [newContactLastName, setNewContactLastName] = useState('');
  const [newContactEmail, setNewContactEmail] = useState('');
  const [newContactPhone, setNewContactPhone] = useState('');
  const autoPickContactRef = useRef(false);
  const valueRef = useRef(value);
  valueRef.current = value;

  const loadClients = useCallback(async (): Promise<
    ClientContactPickerClient[]
  > => {
    setClientsLoading(true);
    try {
      const result = (await listClients({
        accountId,
        page: 1,
        pageSize: 100,
      })) as { data?: ClientContactPickerClient[] };
      const next = Array.isArray(result?.data) ? result.data : [];
      setClients(next);
      return next;
    } catch {
      setClients([]);
      return [];
    } finally {
      setClientsLoading(false);
    }
  }, [accountId]);

  const loadContacts = useCallback(
    async (clientId: string): Promise<ClientContactPickerContact[]> => {
      if (!clientId) {
        setContacts([]);
        return [];
      }
      setContactsLoading(true);
      try {
        const result = (await listContacts({ accountId, clientId })) as {
          data?: ClientContactPickerContact[];
        };
        const next = Array.isArray(result?.data) ? result.data : [];
        setContacts(next);
        return next;
      } catch {
        setContacts([]);
        return [];
      } finally {
        setContactsLoading(false);
      }
    },
    [accountId],
  );

  const resetCreatePanels = useCallback(() => {
    setShowNewClient(false);
    setShowNewContact(false);
    setNewCompanyName('');
    setNewFirstName('');
    setNewLastName('');
    setNewClientEmail('');
    setNewClientPhone('');
    setNewContactFirstName('');
    setNewContactLastName('');
    setNewContactEmail('');
    setNewContactPhone('');
    setNewClientType('business');
  }, []);

  useEffect(() => {
    if (!active) return;
    resetCreatePanels();
    void loadClients();
  }, [active, loadClients, resetCreatePanels]);

  const applyClientDetails = useCallback(
    (
      client: ClientContactPickerClient,
      base: ClientContactPickerValue,
    ): ClientContactPickerValue => {
      const label = clientLabel(client);
      return {
        ...base,
        clientId: client.id,
        companyName:
          client.client_type === 'individual'
            ? label
            : client.company_name || client.display_name || label,
        contactName:
          client.client_type === 'individual' ? label : base.contactName,
        contactEmail:
          client.client_type === 'individual'
            ? (client.email ?? base.contactEmail)
            : base.contactEmail,
        contactPhone:
          client.client_type === 'individual'
            ? (client.phone ?? base.contactPhone)
            : base.contactPhone,
      };
    },
    [],
  );

  const applyContactDetails = useCallback(
    (
      contact: ClientContactPickerContact,
      base: ClientContactPickerValue,
    ): ClientContactPickerValue => ({
      ...base,
      contactId: contact.id,
      contactName: contact.full_name || base.contactName,
      contactEmail: contact.email ?? base.contactEmail,
      contactPhone: contact.phone ?? base.contactPhone,
    }),
    [],
  );

  useEffect(() => {
    if (!active || !value.clientId) {
      setContacts([]);
      return;
    }
    void (async () => {
      const next = await loadContacts(value.clientId);
      if (!autoPickContactRef.current) return;
      autoPickContactRef.current = false;
      const primary = next.find((c) => c.is_primary) ?? next[0] ?? null;
      if (!primary) return;
      onChange(applyContactDetails(primary, valueRef.current));
    })();
    // Intentionally depend on clientId only — avoid looping on value/onChange.
    // eslint-disable-next-line react-hooks/exhaustive-deps -- auto-pick on client change
  }, [active, value.clientId, loadContacts, applyContactDetails]);

  const handleClientChange = (clientId: string) => {
    const client = clients.find((c) => c.id === clientId) ?? null;
    autoPickContactRef.current = Boolean(clientId);
    const cleared: ClientContactPickerValue = {
      clientId,
      contactId: '',
      companyName: '',
      contactName: '',
      contactEmail: '',
      contactPhone: '',
    };
    setShowNewContact(false);
    onChange(client ? applyClientDetails(client, cleared) : cleared);
  };

  const handleContactChange = (contactId: string) => {
    if (contactId === 'none') {
      autoPickContactRef.current = false;
      onChange({ ...value, contactId: '' });
      return;
    }
    const contact = contacts.find((c) => c.id === contactId) ?? null;
    if (contact) onChange(applyContactDetails(contact, value));
  };

  const handleCreateClient = async () => {
    setCreatingClient(true);
    onError?.(null);
    try {
      const isBusiness = newClientType === 'business';
      if (isBusiness && !newCompanyName.trim()) {
        onError?.('Company name is required');
        return;
      }
      if (!isBusiness && !newFirstName.trim()) {
        onError?.('First name is required');
        return;
      }

      const created = (await createClient({
        accountId,
        client_type: newClientType,
        company_name: isBusiness ? newCompanyName.trim() : undefined,
        first_name: isBusiness
          ? newContactFirstName.trim() || newFirstName.trim() || undefined
          : newFirstName.trim(),
        last_name: isBusiness
          ? newContactLastName.trim() || undefined
          : newLastName.trim() || undefined,
        email: newClientEmail.trim() || undefined,
        phone: newClientPhone.trim() || undefined,
        contact:
          isBusiness && newContactFirstName.trim()
            ? {
                firstName: newContactFirstName.trim(),
                lastName: newContactLastName.trim() || undefined,
                email:
                  newContactEmail.trim() || newClientEmail.trim() || undefined,
                phone:
                  newContactPhone.trim() || newClientPhone.trim() || undefined,
                isPrimary: true,
              }
            : undefined,
      })) as { id?: string } | null;

      const fresh = await loadClients();
      const newId =
        created?.id ??
        fresh.find(
          (c) =>
            clientLabel(c).toLowerCase() ===
            (isBusiness
              ? newCompanyName.trim().toLowerCase()
              : [newFirstName, newLastName]
                  .map((p) => p.trim())
                  .filter(Boolean)
                  .join(' ')
                  .toLowerCase()),
        )?.id;

      if (!newId) {
        onError?.(
          'Client created, but could not select it. Pick it from the list.',
        );
        setShowNewClient(false);
        return;
      }

      const client = fresh.find((c) => c.id === newId) ?? null;
      autoPickContactRef.current = true;
      const next: ClientContactPickerValue = {
        clientId: newId,
        contactId: '',
        companyName: '',
        contactName: '',
        contactEmail: '',
        contactPhone: '',
      };
      onChange(client ? applyClientDetails(client, next) : next);
      resetCreatePanels();
    } catch (err) {
      onError?.(err instanceof Error ? err.message : 'Could not create client');
    } finally {
      setCreatingClient(false);
    }
  };

  const handleCreateContact = async () => {
    if (!value.clientId) {
      onError?.('Select a client first');
      return;
    }
    if (!newContactFirstName.trim()) {
      onError?.('Contact first name is required');
      return;
    }

    setCreatingContact(true);
    onError?.(null);
    try {
      const created = (await createContact({
        accountId,
        clientId: value.clientId,
        firstName: newContactFirstName.trim(),
        lastName: newContactLastName.trim() || undefined,
        email: newContactEmail.trim() || undefined,
        phone: newContactPhone.trim() || undefined,
        isPrimary: contacts.length === 0,
      })) as { id?: string } | null;

      const nextContacts = await loadContacts(value.clientId);
      const newId =
        created?.id ??
        nextContacts.find(
          (c) =>
            c.full_name.toLowerCase() ===
            [newContactFirstName, newContactLastName]
              .map((p) => p.trim())
              .filter(Boolean)
              .join(' ')
              .toLowerCase(),
        )?.id;

      const contact =
        nextContacts.find((c) => c.id === newId) ?? nextContacts[0] ?? null;
      if (contact) onChange(applyContactDetails(contact, value));

      setShowNewContact(false);
      setNewContactFirstName('');
      setNewContactLastName('');
      setNewContactEmail('');
      setNewContactPhone('');
    } catch (err) {
      onError?.(
        err instanceof Error ? err.message : 'Could not create contact',
      );
    } finally {
      setCreatingContact(false);
    }
  };

  const summaryParts = [
    value.companyName,
    value.contactName,
    value.contactEmail,
    value.contactPhone,
  ].filter(Boolean);

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <div className="flex items-center justify-between gap-2">
          <Label>Client</Label>
          <button
            type="button"
            onClick={() => {
              setShowNewClient((v) => !v);
              setShowNewContact(false);
            }}
            className="inline-flex items-center gap-1 text-xs font-medium text-[var(--ozer-accent)] hover:underline"
          >
            <Plus className="h-3 w-3" />
            {showNewClient ? 'Cancel' : 'New client'}
          </button>
        </div>
        <ClientCombobox
          clients={clients.map((c) => ({
            id: c.id,
            display_name: clientLabel(c),
          }))}
          value={value.clientId}
          onValueChange={handleClientChange}
          loading={clientsLoading}
          placeholder={allowNone ? 'Select client (optional)' : 'Select client'}
          emptyMessage="No clients yet. Create one below."
        />
        {showNewClient ? (
          <div className="space-y-3 rounded-lg border border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-sidebar-accent)] p-3">
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setNewClientType('business')}
                className={`flex-1 rounded-md px-3 py-1.5 text-sm font-medium ${
                  newClientType === 'business'
                    ? 'bg-[var(--ozer-accent)] text-[var(--ozer-white)]'
                    : 'bg-[var(--workspace-control-surface)] text-[var(--workspace-shell-text-muted)]'
                }`}
              >
                Business
              </button>
              <button
                type="button"
                onClick={() => setNewClientType('individual')}
                className={`flex-1 rounded-md px-3 py-1.5 text-sm font-medium ${
                  newClientType === 'individual'
                    ? 'bg-[var(--ozer-accent)] text-[var(--ozer-white)]'
                    : 'bg-[var(--workspace-control-surface)] text-[var(--workspace-shell-text-muted)]'
                }`}
              >
                Individual
              </button>
            </div>
            {newClientType === 'business' ? (
              <>
                <Input
                  value={newCompanyName}
                  onChange={(e) => setNewCompanyName(e.target.value)}
                  placeholder="Company name"
                  className={inputClass}
                />
                <div className="grid grid-cols-2 gap-2">
                  <Input
                    value={newContactFirstName}
                    onChange={(e) => setNewContactFirstName(e.target.value)}
                    placeholder="Contact first name"
                    className={inputClass}
                  />
                  <Input
                    value={newContactLastName}
                    onChange={(e) => setNewContactLastName(e.target.value)}
                    placeholder="Contact last name"
                    className={inputClass}
                  />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <Input
                    type="email"
                    value={newContactEmail}
                    onChange={(e) => setNewContactEmail(e.target.value)}
                    placeholder="Contact email"
                    className={inputClass}
                  />
                  <Input
                    value={newContactPhone}
                    onChange={(e) => setNewContactPhone(e.target.value)}
                    placeholder="Contact phone"
                    className={inputClass}
                  />
                </div>
              </>
            ) : (
              <>
                <div className="grid grid-cols-2 gap-2">
                  <Input
                    value={newFirstName}
                    onChange={(e) => setNewFirstName(e.target.value)}
                    placeholder="First name"
                    className={inputClass}
                  />
                  <Input
                    value={newLastName}
                    onChange={(e) => setNewLastName(e.target.value)}
                    placeholder="Last name"
                    className={inputClass}
                  />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <Input
                    type="email"
                    value={newClientEmail}
                    onChange={(e) => setNewClientEmail(e.target.value)}
                    placeholder="Email"
                    className={inputClass}
                  />
                  <Input
                    value={newClientPhone}
                    onChange={(e) => setNewClientPhone(e.target.value)}
                    placeholder="Phone"
                    className={inputClass}
                  />
                </div>
              </>
            )}
            <Button
              type="button"
              size="sm"
              disabled={creatingClient}
              onClick={() => void handleCreateClient()}
              className={workspaceBtnPrimaryMd}
            >
              {creatingClient ? 'Creating…' : 'Create client'}
            </Button>
          </div>
        ) : null}
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between gap-2">
          <Label>Contact</Label>
          <button
            type="button"
            disabled={!value.clientId}
            onClick={() => {
              setShowNewContact((v) => !v);
              setShowNewClient(false);
            }}
            className="inline-flex items-center gap-1 text-xs font-medium text-[var(--ozer-accent)] hover:underline disabled:opacity-40"
          >
            <Plus className="h-3 w-3" />
            {showNewContact ? 'Cancel' : 'New contact'}
          </button>
        </div>
        <Select
          value={value.contactId || 'none'}
          onValueChange={handleContactChange}
          disabled={!value.clientId || contactsLoading}
        >
          <SelectTrigger className={inputClass}>
            <SelectValue
              placeholder={
                !value.clientId
                  ? 'Select a client first'
                  : contactsLoading
                    ? 'Loading…'
                    : 'Select contact'
              }
            />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="none">None</SelectItem>
            {contacts.map((c) => (
              <SelectItem key={c.id} value={c.id}>
                {c.full_name}
                {c.is_primary ? ' (primary)' : ''}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {value.clientId && !contactsLoading && contacts.length === 0 ? (
          <p className="text-xs text-[var(--workspace-shell-text)]/50">
            No contacts on this client yet. Create one above.
          </p>
        ) : null}
        {showNewContact ? (
          <div className="space-y-3 rounded-lg border border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-sidebar-accent)] p-3">
            <div className="grid grid-cols-2 gap-2">
              <Input
                value={newContactFirstName}
                onChange={(e) => setNewContactFirstName(e.target.value)}
                placeholder="First name"
                className={inputClass}
              />
              <Input
                value={newContactLastName}
                onChange={(e) => setNewContactLastName(e.target.value)}
                placeholder="Last name"
                className={inputClass}
              />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <Input
                type="email"
                value={newContactEmail}
                onChange={(e) => setNewContactEmail(e.target.value)}
                placeholder="Email"
                className={inputClass}
              />
              <Input
                value={newContactPhone}
                onChange={(e) => setNewContactPhone(e.target.value)}
                placeholder="Phone"
                className={inputClass}
              />
            </div>
            <Button
              type="button"
              size="sm"
              disabled={creatingContact}
              onClick={() => void handleCreateContact()}
              className={workspaceBtnPrimaryMd}
            >
              {creatingContact ? 'Creating…' : 'Create contact'}
            </Button>
          </div>
        ) : null}
      </div>

      {showSummary && summaryParts.length > 0 ? (
        <div className="rounded-lg border border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-sidebar-accent)] px-3 py-2 text-xs text-[var(--workspace-shell-text)]/70">
          <span className="font-medium text-[var(--workspace-shell-text)]">
            Linked as
          </span>
          {': '}
          {summaryParts.join(' · ')}
        </div>
      ) : null}
    </div>
  );
}
