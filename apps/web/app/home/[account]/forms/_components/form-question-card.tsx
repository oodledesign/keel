'use client';

import {
  ChevronDown,
  ChevronUp,
  Copy,
  GripHorizontal,
  Trash2,
} from 'lucide-react';

import { Button } from '@kit/ui/button';
import { Input } from '@kit/ui/input';
import { Label } from '@kit/ui/label';
import { Switch } from '@kit/ui/switch';
import { Textarea } from '@kit/ui/textarea';
import { cn } from '@kit/ui/utils';

import {
  type WorkspaceFormField,
  type WorkspaceFormFieldType,
  fieldTypeUsesOptions,
} from '~/lib/workspace-forms/form-fields';
import {
  workspacePanelCard,
  workspaceText,
  workspaceTextMuted,
} from '~/lib/workspace-ui';

import { FormFieldTypePicker } from './form-field-type-picker';

type Props = {
  field: WorkspaceFormField;
  index: number;
  total: number;
  active: boolean;
  onActivate: () => void;
  onChange: (patch: Partial<WorkspaceFormField>) => void;
  onChangeType: (type: WorkspaceFormFieldType) => void;
  onMove: (direction: -1 | 1) => void;
  onDuplicate: () => void;
  onRemove: () => void;
};

export function FormQuestionCard({
  field,
  index,
  total,
  active,
  onActivate,
  onChange,
  onChangeType,
  onMove,
  onDuplicate,
  onRemove,
}: Props) {
  return (
    <div
      onClick={onActivate}
      className={cn(
        workspacePanelCard,
        'relative cursor-pointer overflow-hidden p-5 transition-shadow',
        active &&
          'ring-1 ring-[var(--ozer-accent)]/25 before:absolute before:top-0 before:bottom-0 before:left-0 before:w-1.5 before:bg-[var(--ozer-accent)]',
      )}
      data-test={`form-question-card-${field.key}`}
      data-active={active ? 'true' : 'false'}
    >
      <div
        className={`mb-3 flex justify-center ${workspaceTextMuted}`}
        aria-hidden
      >
        <GripHorizontal className="h-4 w-4" />
      </div>

      <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_220px]">
        <div className="grid gap-1.5">
          <Label>Question</Label>
          <Input
            value={field.label}
            onChange={(event) => onChange({ label: event.target.value })}
            onFocus={onActivate}
            placeholder="Question"
          />
        </div>
        <div className="grid gap-1.5">
          <Label>Type</Label>
          <FormFieldTypePicker
            value={field.type}
            onSelect={onChangeType}
            triggerClassName="w-full"
          />
        </div>
      </div>

      {fieldTypeUsesOptions(field.type) ? (
        <div className="mt-3 grid gap-1.5">
          <Label>
            {field.type === 'yes_no'
              ? 'Choices (compact buttons on the public page)'
              : 'Options (one per line)'}
          </Label>
          <Textarea
            rows={field.type === 'yes_no' ? 2 : 3}
            value={(field.options ?? []).join('\n')}
            onFocus={onActivate}
            onChange={(event) =>
              onChange({
                options: event.target.value
                  .split('\n')
                  .map((line) => line.trim())
                  .filter(Boolean),
              })
            }
          />
          {field.type === 'yes_no' ? (
            <div
              className={cn(
                'grid gap-2',
                (field.options?.length ?? 2) <= 2
                  ? 'grid-cols-2'
                  : 'max-w-md grid-cols-2 sm:grid-cols-3',
              )}
              aria-hidden
            >
              {(field.options && field.options.length >= 2
                ? field.options.slice(0, 4)
                : ['Yes', 'No']
              ).map((option) => (
                <span
                  key={option}
                  className="flex min-h-11 items-center justify-center rounded-xl border-2 border-[color:var(--workspace-shell-border)] bg-[var(--ozer-cream-50,#FBF6EC)] px-3 py-2 text-sm font-semibold text-[var(--workspace-shell-text)]"
                >
                  {option}
                </span>
              ))}
            </div>
          ) : null}
        </div>
      ) : null}

      {field.type === 'file' ? (
        <p className={`mt-3 text-xs ${workspaceTextMuted}`}>
          Public visitors see a note that files are not collected yet. Storage
          upload is a follow-up.
        </p>
      ) : null}

      {field.type === 'text' ||
      field.type === 'textarea' ||
      field.type === 'name' ||
      field.type === 'email' ||
      field.type === 'phone' ||
      field.type === 'message' ? (
        <div className="mt-3 grid gap-1.5">
          <Label>Placeholder</Label>
          <Input
            value={field.placeholder ?? ''}
            onFocus={onActivate}
            onChange={(event) => onChange({ placeholder: event.target.value })}
            placeholder="Shown as empty hint text"
          />
        </div>
      ) : null}

      <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
        <label className={`flex items-center gap-2 text-sm ${workspaceText}`}>
          <Switch
            checked={field.required}
            onCheckedChange={(checked) => onChange({ required: checked })}
          />
          Required
        </label>
        <div className="flex items-center gap-1">
          <span className={`mr-2 text-xs ${workspaceTextMuted}`}>
            key: {field.key}
          </span>
          <Button
            type="button"
            size="icon"
            variant="ghost"
            disabled={index === 0}
            onClick={(event) => {
              event.stopPropagation();
              onMove(-1);
            }}
            aria-label="Move field up"
          >
            <ChevronUp className="h-4 w-4" />
          </Button>
          <Button
            type="button"
            size="icon"
            variant="ghost"
            disabled={index === total - 1}
            onClick={(event) => {
              event.stopPropagation();
              onMove(1);
            }}
            aria-label="Move field down"
          >
            <ChevronDown className="h-4 w-4" />
          </Button>
          <Button
            type="button"
            size="icon"
            variant="ghost"
            onClick={(event) => {
              event.stopPropagation();
              onDuplicate();
            }}
            aria-label="Duplicate field"
          >
            <Copy className="h-4 w-4" />
          </Button>
          <Button
            type="button"
            size="icon"
            variant="ghost"
            onClick={(event) => {
              event.stopPropagation();
              onRemove();
            }}
            aria-label="Remove field"
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
