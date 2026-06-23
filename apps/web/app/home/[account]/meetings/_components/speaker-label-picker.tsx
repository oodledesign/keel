'use client';

import { useMemo, useState } from 'react';

import { Check, ChevronsUpDown, Plus, X } from 'lucide-react';

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
import { toast } from '@kit/ui/sonner';
import { cn } from '@kit/ui/utils';

import { createWorkspaceContact } from '~/home/[account]/clients/_lib/server/server-actions';
import type { SpeakerBinding } from '~/lib/recorder/transcript-speakers';

export type SpeakerPickerClient = { id: string; name: string };
export type SpeakerPickerContact = { id: string; name: string; email?: string | null };

type AssignMode = 'custom' | 'client' | 'contact';

type Props = {
  accountId: string;
  binding: SpeakerBinding | null;
  onBindingChange: (binding: SpeakerBinding | null) => void;
  clients: SpeakerPickerClient[];
  contacts: SpeakerPickerContact[];
  linkClientId?: string | null;
  onContactCreated?: (contact: SpeakerPickerContact) => void;
  disabled?: boolean;
};

function bindingLabel(
  binding: SpeakerBinding | null,
  clients: SpeakerPickerClient[],
  contacts: SpeakerPickerContact[],
): string | null {
  if (!binding) return null;
  if (binding.type === 'custom') return binding.name;
  if (binding.type === 'client') {
    return clients.find((client) => client.id === binding.clientId)?.name ?? null;
  }
  return contacts.find((contact) => contact.id === binding.contactId)?.name ?? null;
}

function SearchableSelect({
  options,
  value,
  placeholder,
  emptyMessage,
  onValueChange,
  disabled,
}: {
  options: Array<{ id: string; label: string; hint?: string | null }>;
  value: string;
  placeholder: string;
  emptyMessage: string;
  onValueChange: (id: string) => void;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const selected = options.find((option) => option.id === value);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          disabled={disabled}
          className={cn(
            'w-full justify-between border-white/10 bg-white/5 text-white hover:bg-white/10 hover:text-white',
            !selected && 'text-zinc-500',
          )}
        >
          {selected ? selected.label : placeholder}
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        className="w-[var(--radix-popover-trigger-width)] border-white/10 bg-[#1A2535] p-0"
        align="start"
      >
        <Command className="bg-[#1A2535]">
          <CommandInput
            placeholder="Search…"
            className="border-white/10 bg-white/5 text-white placeholder:text-zinc-500"
          />
          <CommandList>
            <CommandEmpty>{emptyMessage}</CommandEmpty>
            <CommandGroup>
              {options.map((option) => (
                <CommandItem
                  key={option.id}
                  value={`${option.label} ${option.hint ?? ''}`}
                  onSelect={() => {
                    onValueChange(option.id);
                    setOpen(false);
                  }}
                  className="text-zinc-200 aria-selected:bg-white/10"
                >
                  <Check
                    className={cn(
                      'mr-2 h-4 w-4',
                      value === option.id ? 'opacity-100' : 'opacity-0',
                    )}
                  />
                  <span>{option.label}</span>
                  {option.hint ? (
                    <span className="ml-2 truncate text-xs text-zinc-500">{option.hint}</span>
                  ) : null}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

export function SpeakerLabelPicker({
  accountId,
  binding,
  onBindingChange,
  clients,
  contacts,
  linkClientId,
  onContactCreated,
  disabled = false,
}: Props) {
  const [mode, setMode] = useState<AssignMode>(() => {
    if (binding?.type === 'client') return 'client';
    if (binding?.type === 'contact') return 'contact';
    return 'custom';
  });
  const [customName, setCustomName] = useState(
    binding?.type === 'custom' ? binding.name : '',
  );
  const [selectedClientId, setSelectedClientId] = useState(
    binding?.type === 'client' ? binding.clientId : '',
  );
  const [selectedContactId, setSelectedContactId] = useState(
    binding?.type === 'contact' ? binding.contactId : '',
  );
  const [showCreateContact, setShowCreateContact] = useState(false);
  const [newContactName, setNewContactName] = useState('');
  const [newContactEmail, setNewContactEmail] = useState('');
  const [creatingContact, setCreatingContact] = useState(false);

  const linkedLabel = useMemo(
    () => bindingLabel(binding, clients, contacts),
    [binding, clients, contacts],
  );

  const isLinkedRecord =
    binding?.type === 'client' || binding?.type === 'contact';

  const applyCustom = (name: string) => {
    const trimmed = name.trim();
    if (!trimmed) {
      onBindingChange(null);
      return;
    }
    onBindingChange({ type: 'custom', name: trimmed });
  };

  const applyClient = (clientId: string) => {
    if (!clientId) {
      onBindingChange(null);
      return;
    }
    onBindingChange({ type: 'client', clientId });
  };

  const applyContact = (contactId: string) => {
    if (!contactId) {
      onBindingChange(null);
      return;
    }
    onBindingChange({ type: 'contact', contactId });
  };

  const clearBinding = () => {
    onBindingChange(null);
    setCustomName('');
    setSelectedClientId('');
    setSelectedContactId('');
    setMode('custom');
  };

  const handleCreateContact = async () => {
    const fullName = newContactName.trim();
    if (!fullName) {
      toast.error('Contact name is required');
      return;
    }

    setCreatingContact(true);
    try {
      const created = (await createWorkspaceContact({
        accountId,
        fullName,
        email: newContactEmail.trim() || undefined,
        linkClientId: linkClientId ?? undefined,
      })) as { id: string; full_name: string; email?: string | null };

      const contact = {
        id: created.id,
        name: created.full_name,
        email: created.email ?? null,
      };

      onContactCreated?.(contact);
      setSelectedContactId(contact.id);
      setMode('contact');
      onBindingChange({ type: 'contact', contactId: contact.id });
      setShowCreateContact(false);
      setNewContactName('');
      setNewContactEmail('');
      toast.success('Contact created');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to create contact');
    } finally {
      setCreatingContact(false);
    }
  };

  if (isLinkedRecord && linkedLabel) {
    return (
      <div className="flex items-center gap-2">
        <div className="min-w-0 flex-1 rounded-lg border border-white/10 bg-white/5 px-3 py-2">
          <p className="truncate text-sm font-medium text-white">{linkedLabel}</p>
          <p className="text-xs text-zinc-500">
            {binding?.type === 'client' ? 'Client' : 'Contact'} · updates automatically
          </p>
        </div>
        {!disabled ? (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="shrink-0 text-zinc-400 hover:text-white"
            onClick={clearBinding}
            aria-label="Change assignment"
          >
            <X className="h-4 w-4" />
          </Button>
        ) : null}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex rounded-md border border-white/10 p-0.5 text-xs">
        {(['custom', 'client', 'contact'] as AssignMode[]).map((option) => (
          <button
            key={option}
            type="button"
            disabled={disabled}
            onClick={() => setMode(option)}
            className={cn(
              'flex-1 rounded px-2 py-1.5 capitalize transition',
              mode === option
                ? 'bg-white/10 text-white'
                : 'text-zinc-400 hover:text-white',
            )}
          >
            {option}
          </button>
        ))}
      </div>

      {mode === 'custom' ? (
        <Input
          value={customName}
          disabled={disabled}
          onChange={(event) => {
            const next = event.target.value;
            setCustomName(next);
            applyCustom(next);
          }}
          placeholder="Type a name"
          className="border-white/10 bg-white/5 text-white"
        />
      ) : null}

      {mode === 'client' ? (
        <SearchableSelect
          options={clients.map((client) => ({ id: client.id, label: client.name }))}
          value={selectedClientId}
          placeholder="Select client"
          emptyMessage="No clients found"
          disabled={disabled}
          onValueChange={(clientId) => {
            setSelectedClientId(clientId);
            applyClient(clientId);
          }}
        />
      ) : null}

      {mode === 'contact' ? (
        <div className="space-y-2">
          <SearchableSelect
            options={contacts.map((contact) => ({
              id: contact.id,
              label: contact.name,
              hint: contact.email,
            }))}
            value={selectedContactId}
            placeholder="Select contact"
            emptyMessage="No contacts yet"
            disabled={disabled}
            onValueChange={(contactId) => {
              setSelectedContactId(contactId);
              applyContact(contactId);
            }}
          />
          {!disabled && !showCreateContact ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="w-full border-white/10 bg-white/5 text-zinc-300 hover:bg-white/10 hover:text-white"
              onClick={() => setShowCreateContact(true)}
            >
              <Plus className="mr-2 h-4 w-4" />
              New contact
            </Button>
          ) : null}
          {showCreateContact ? (
            <div className="space-y-2 rounded-lg border border-white/10 bg-black/20 p-3">
              <div>
                <Label className="text-xs text-zinc-500">Name</Label>
                <Input
                  value={newContactName}
                  onChange={(event) => setNewContactName(event.target.value)}
                  className="mt-1 border-white/10 bg-white/5 text-white"
                  placeholder="Contact name"
                />
              </div>
              <div>
                <Label className="text-xs text-zinc-500">Email</Label>
                <Input
                  type="email"
                  value={newContactEmail}
                  onChange={(event) => setNewContactEmail(event.target.value)}
                  className="mt-1 border-white/10 bg-white/5 text-white"
                  placeholder="Optional"
                />
              </div>
              <div className="flex gap-2">
                <Button
                  type="button"
                  size="sm"
                  disabled={creatingContact}
                  className="bg-[var(--keel-teal)] text-white hover:bg-[#238b7f]"
                  onClick={() => void handleCreateContact()}
                >
                  {creatingContact ? 'Creating…' : 'Create'}
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="border-white/10 text-zinc-300"
                  onClick={() => setShowCreateContact(false)}
                >
                  Cancel
                </Button>
              </div>
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
