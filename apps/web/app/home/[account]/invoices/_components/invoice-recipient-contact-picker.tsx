'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';

import { Users } from 'lucide-react';

import { Button } from '@kit/ui/button';
import { Input } from '@kit/ui/input';
import { Label } from '@kit/ui/label';
import { Popover, PopoverContent, PopoverTrigger } from '@kit/ui/popover';

import { listContacts } from '~/home/[account]/clients/_lib/server/server-actions';
import { formatContactRoleLabel } from '~/lib/clients/contact-roles';

type ClientContactOption = {
  id: string;
  full_name: string;
  email: string | null;
  role: string | null;
  is_primary?: boolean;
};

export function InvoiceRecipientContactPicker({
  accountId,
  clientId,
  value,
  onChange,
  id = 'invoice-recipient-email',
  placeholder = 'billing@client.com',
  disabled = false,
  active,
}: {
  accountId: string;
  clientId: string;
  value: string;
  onChange: (email: string) => void;
  id?: string;
  placeholder?: string;
  disabled?: boolean;
  active: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [contacts, setContacts] = useState<ClientContactOption[]>([]);

  const loadContacts = useCallback(async () => {
    if (!active || !clientId) {
      setContacts([]);
      return;
    }

    setLoading(true);
    try {
      const result = (await listContacts({ accountId, clientId })) as {
        data?: ClientContactOption[];
      };
      setContacts(Array.isArray(result?.data) ? result.data : []);
    } catch {
      setContacts([]);
    } finally {
      setLoading(false);
    }
  }, [accountId, active, clientId]);

  useEffect(() => {
    if (!active) return;
    void loadContacts();
  }, [active, loadContacts]);

  const contactsWithEmail = useMemo(
    () =>
      contacts.filter(
        (contact) => Boolean(contact.email?.trim()) && Boolean(contact.id),
      ),
    [contacts],
  );

  const selectedContact = useMemo(() => {
    const email = value.trim().toLowerCase();
    if (!email) return null;
    return (
      contactsWithEmail.find(
        (contact) => contact.email?.trim().toLowerCase() === email,
      ) ?? null
    );
  }, [contactsWithEmail, value]);

  return (
    <div className="space-y-2">
      <Label htmlFor={id}>Recipient email</Label>
      <div className="flex items-center gap-2">
        <Input
          id={id}
          type="email"
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder={placeholder}
          disabled={disabled}
          data-test="recurring-recipient-email"
          className="flex-1"
        />
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild>
            <Button
              type="button"
              variant="outline"
              disabled={disabled || !clientId}
              data-test="recurring-recipient-contact-picker"
              className="shrink-0 border-[color:var(--workspace-control-border)] bg-[var(--workspace-control-surface)] text-[var(--workspace-shell-text)]"
            >
              <Users className="mr-1.5 h-4 w-4" />
              Contacts
            </Button>
          </PopoverTrigger>
          <PopoverContent
            align="end"
            className="w-80 space-y-2 border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-panel)] p-3"
          >
            <p className="text-xs font-medium text-[var(--workspace-shell-text)]">
              Client contacts
            </p>
            {loading ? (
              <p className="text-xs text-[var(--workspace-shell-text-muted)]">
                Loading…
              </p>
            ) : contactsWithEmail.length === 0 ? (
              <p className="text-xs text-[var(--workspace-shell-text-muted)]">
                No contacts with an email on this client.
              </p>
            ) : (
              <div className="max-h-48 space-y-1 overflow-y-auto">
                {contactsWithEmail.map((contact) => {
                  const email = contact.email?.trim() ?? '';
                  const selected =
                    email.toLowerCase() === value.trim().toLowerCase();

                  return (
                    <button
                      key={contact.id}
                      type="button"
                      className="flex w-full flex-col rounded-md px-2 py-1.5 text-left hover:bg-[var(--workspace-shell-panel-hover)]"
                      onClick={() => {
                        onChange(email);
                        setOpen(false);
                      }}
                    >
                      <span className="text-sm text-[var(--workspace-shell-text)]">
                        {contact.full_name}
                        {contact.is_primary ? ' (primary)' : ''}
                        {selected ? ' · selected' : ''}
                      </span>
                      <span className="text-[11px] text-[var(--workspace-shell-text-muted)]">
                        {email}
                        {contact.role
                          ? ` · ${formatContactRoleLabel(contact.role)}`
                          : ''}
                      </span>
                    </button>
                  );
                })}
              </div>
            )}
          </PopoverContent>
        </Popover>
      </div>
      {selectedContact ? (
        <p className="text-muted-foreground text-xs">
          {selectedContact.full_name}
          {selectedContact.role
            ? ` · ${formatContactRoleLabel(selectedContact.role)}`
            : ''}
        </p>
      ) : null}
    </div>
  );
}
