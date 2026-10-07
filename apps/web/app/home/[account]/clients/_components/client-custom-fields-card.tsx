'use client';

import { useCallback, useEffect, useState, useTransition } from 'react';

import { Settings2, Trash2 } from 'lucide-react';

import { Button } from '@kit/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@kit/ui/dialog';
import { Input } from '@kit/ui/input';
import { Label } from '@kit/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@kit/ui/select';
import { toast } from '@kit/ui/sonner';
import { Switch } from '@kit/ui/switch';
import { Textarea } from '@kit/ui/textarea';

import {
  CONTACT_CUSTOM_FIELD_TYPES,
  CONTACT_CUSTOM_FIELD_TYPE_LABELS,
  type ContactCustomFieldDefinition,
  type ContactCustomFieldType,
  type ContactCustomFieldValue,
  type ContactCustomFieldValues,
  formatContactFieldValue,
} from '~/lib/contacts/custom-fields';
import {
  workspaceBtnPrimary,
  workspaceText,
  workspaceTextMuted,
} from '~/lib/workspace-ui';

import {
  createContactCustomFieldAction,
  deleteContactCustomFieldAction,
  loadContactCustomFieldsAction,
  saveContactCustomValuesAction,
  updateContactCustomFieldAction,
} from '../_lib/server/custom-fields-actions';

type Props = {
  accountId: string;
  clientId: string;
  canEdit: boolean;
};

export function ClientCustomFieldsCard({
  accountId,
  clientId,
  canEdit,
}: Props) {
  const [definitions, setDefinitions] = useState<
    ContactCustomFieldDefinition[]
  >([]);
  const [values, setValues] = useState<ContactCustomFieldValues>({});
  const [draft, setDraft] = useState<
    Record<string, ContactCustomFieldValue | ''>
  >({});
  const [loaded, setLoaded] = useState(false);
  const [editing, setEditing] = useState(false);
  const [manageOpen, setManageOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  const load = useCallback(async () => {
    try {
      const result = await loadContactCustomFieldsAction({
        accountId,
        clientId,
      });
      setDefinitions(result.definitions);
      setValues(result.values);
    } catch {
      setDefinitions([]);
    } finally {
      setLoaded(true);
    }
  }, [accountId, clientId]);

  useEffect(() => {
    void load();
  }, [load]);

  function startEdit() {
    setDraft({ ...values });
    setEditing(true);
  }

  function save() {
    startTransition(async () => {
      try {
        const payload: Record<string, string | number | boolean | null> = {};
        for (const definition of definitions) {
          const value = draft[definition.key];
          payload[definition.key] =
            value === undefined || value === '' ? null : value;
        }
        const result = await saveContactCustomValuesAction({
          accountId,
          clientId,
          values: payload,
        });
        setValues(result.values);
        setEditing(false);
        toast.success('Custom fields saved');
      } catch (error) {
        toast.error(
          error instanceof Error ? error.message : 'Could not save fields',
        );
      }
    });
  }

  if (!loaded) return null;
  if (definitions.length === 0 && !canEdit) return null;

  return (
    <section
      className="rounded-2xl border border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-panel)] p-5"
      data-test="client-custom-fields"
    >
      <div className="flex items-center justify-between gap-3">
        <h3 className={`text-sm font-semibold ${workspaceText}`}>
          Custom fields
        </h3>
        {canEdit ? (
          <div className="flex items-center gap-1">
            {definitions.length > 0 && !editing ? (
              <Button
                type="button"
                size="sm"
                variant="ghost"
                onClick={startEdit}
              >
                Edit
              </Button>
            ) : null}
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={() => setManageOpen(true)}
              data-test="manage-contact-fields"
            >
              <Settings2 className="mr-1 h-3.5 w-3.5" />
              Manage fields
            </Button>
          </div>
        ) : null}
      </div>

      {definitions.length === 0 ? (
        <p className={`mt-2 text-sm ${workspaceTextMuted}`}>
          Track anything about your contacts — budget, source, preferred area.
          Add your first field with Manage fields.
        </p>
      ) : editing ? (
        <div className="mt-3 space-y-3">
          {definitions.map((definition) => (
            <FieldInput
              key={definition.key}
              definition={definition}
              value={draft[definition.key] ?? ''}
              onChange={(next) =>
                setDraft((current) => ({ ...current, [definition.key]: next }))
              }
            />
          ))}
          <div className="flex justify-end gap-2">
            <Button
              type="button"
              variant="ghost"
              disabled={pending}
              onClick={() => setEditing(false)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              className={`${workspaceBtnPrimary} rounded-xl`}
              disabled={pending}
              onClick={save}
            >
              {pending ? 'Saving…' : 'Save'}
            </Button>
          </div>
        </div>
      ) : (
        <dl className="mt-3 grid gap-x-6 gap-y-2 sm:grid-cols-2">
          {definitions.map((definition) => (
            <div key={definition.key}>
              <dt className={`text-xs ${workspaceTextMuted}`}>
                {definition.label}
              </dt>
              <dd className={`text-sm ${workspaceText}`}>
                {formatContactFieldValue(values[definition.key])}
              </dd>
            </div>
          ))}
        </dl>
      )}

      <ManageFieldsDialog
        open={manageOpen}
        onOpenChange={setManageOpen}
        accountId={accountId}
        definitions={definitions}
        onChanged={load}
      />
    </section>
  );
}

function FieldInput({
  definition,
  value,
  onChange,
}: {
  definition: ContactCustomFieldDefinition;
  value: ContactCustomFieldValue | '';
  onChange: (value: ContactCustomFieldValue | '') => void;
}) {
  const id = `custom-field-${definition.key}`;
  if (definition.fieldType === 'checkbox') {
    return (
      <label className={`flex items-center gap-2 text-sm ${workspaceText}`}>
        <Switch checked={value === true} onCheckedChange={onChange} />
        {definition.label}
      </label>
    );
  }
  return (
    <div className="grid gap-1.5">
      <Label htmlFor={id}>{definition.label}</Label>
      {definition.fieldType === 'select' ? (
        <Select
          value={typeof value === 'string' && value ? value : '__none__'}
          onValueChange={(next) => onChange(next === '__none__' ? '' : next)}
        >
          <SelectTrigger id={id}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__none__">—</SelectItem>
            {definition.options.map((option) => (
              <SelectItem key={option} value={option}>
                {option}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      ) : (
        <Input
          id={id}
          type={
            definition.fieldType === 'number'
              ? 'number'
              : definition.fieldType === 'date'
                ? 'date'
                : 'text'
          }
          value={typeof value === 'boolean' ? '' : value}
          onChange={(event) =>
            onChange(
              definition.fieldType === 'number' && event.target.value !== ''
                ? Number(event.target.value)
                : event.target.value,
            )
          }
        />
      )}
    </div>
  );
}

function ManageFieldsDialog({
  open,
  onOpenChange,
  accountId,
  definitions,
  onChanged,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  accountId: string;
  definitions: ContactCustomFieldDefinition[];
  onChanged: () => Promise<void>;
}) {
  const [label, setLabel] = useState('');
  const [fieldType, setFieldType] = useState<ContactCustomFieldType>('text');
  const [options, setOptions] = useState('');
  const [pending, startTransition] = useTransition();

  function add() {
    startTransition(async () => {
      try {
        await createContactCustomFieldAction({
          accountId,
          label,
          fieldType,
          options:
            fieldType === 'select'
              ? options
                  .split('\n')
                  .map((line) => line.trim())
                  .filter(Boolean)
              : undefined,
        });
        setLabel('');
        setOptions('');
        await onChanged();
        toast.success('Field added');
      } catch (error) {
        toast.error(
          error instanceof Error ? error.message : 'Could not add field',
        );
      }
    });
  }

  function rename(definition: ContactCustomFieldDefinition, next: string) {
    const trimmed = next.trim();
    if (!trimmed || trimmed === definition.label) return;
    startTransition(async () => {
      try {
        await updateContactCustomFieldAction({
          accountId,
          id: definition.id,
          label: trimmed,
        });
        await onChanged();
      } catch (error) {
        toast.error(
          error instanceof Error ? error.message : 'Could not rename field',
        );
      }
    });
  }

  function remove(definition: ContactCustomFieldDefinition) {
    if (
      !window.confirm(
        `Delete "${definition.label}"? Values stay hidden on contacts and reappear if you recreate the field.`,
      )
    ) {
      return;
    }
    startTransition(async () => {
      try {
        await deleteContactCustomFieldAction({
          accountId,
          id: definition.id,
        });
        await onChanged();
      } catch (error) {
        toast.error(
          error instanceof Error ? error.message : 'Could not delete field',
        );
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Custom contact fields</DialogTitle>
          <DialogDescription>
            Fields apply to every contact in this workspace. Sign-up form
            questions can save their answers into a field.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2">
          {definitions.map((definition) => (
            <div key={definition.id} className="flex items-center gap-2">
              <Input
                defaultValue={definition.label}
                disabled={pending}
                onBlur={(event) => rename(definition, event.target.value)}
                aria-label={`Rename ${definition.label}`}
              />
              <span className={`shrink-0 text-xs ${workspaceTextMuted}`}>
                {CONTACT_CUSTOM_FIELD_TYPE_LABELS[definition.fieldType]}
              </span>
              <Button
                type="button"
                size="icon"
                variant="ghost"
                disabled={pending}
                onClick={() => remove(definition)}
                aria-label={`Delete ${definition.label}`}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          ))}
        </div>

        <div className="grid gap-3 border-t border-[color:var(--workspace-shell-border)] pt-4">
          <div className="grid gap-3 sm:grid-cols-[1fr_160px]">
            <div className="grid gap-1.5">
              <Label htmlFor="new-contact-field">New field name</Label>
              <Input
                id="new-contact-field"
                value={label}
                onChange={(event) => setLabel(event.target.value)}
                placeholder="e.g. Budget, Lead source"
                data-test="new-contact-field-name"
              />
            </div>
            <div className="grid gap-1.5">
              <Label>Type</Label>
              <Select
                value={fieldType}
                onValueChange={(value) =>
                  setFieldType(value as ContactCustomFieldType)
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CONTACT_CUSTOM_FIELD_TYPES.map((type) => (
                    <SelectItem key={type} value={type}>
                      {CONTACT_CUSTOM_FIELD_TYPE_LABELS[type]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          {fieldType === 'select' ? (
            <div className="grid gap-1.5">
              <Label>Choices (one per line)</Label>
              <Textarea
                rows={3}
                value={options}
                onChange={(event) => setOptions(event.target.value)}
              />
            </div>
          ) : null}
          <div className="flex justify-end">
            <Button
              type="button"
              disabled={pending || !label.trim()}
              onClick={add}
              data-test="add-contact-field"
            >
              Add field
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
