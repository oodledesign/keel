'use client';

import { useEffect, useState, useTransition } from 'react';

import {
  DndContext,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  arrayMove,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { GripVertical, Plus, Trash2 } from 'lucide-react';

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

import {
  PROJECT_FIELD_TYPES,
  PROJECT_FIELD_TYPE_LABELS,
  type ProjectFieldDefinition,
  type ProjectFieldType,
} from '~/lib/campaign-projects/types';

import {
  createProjectField,
  deleteProjectField,
  reorderProjectFields,
} from '../_lib/server/server-actions';

function SortableFieldRow({
  field,
  canDelete,
  onDelete,
}: {
  field: ProjectFieldDefinition;
  canDelete: boolean;
  onDelete: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: field.id });

  return (
    <div
      ref={setNodeRef}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
      }}
      className={`flex items-center gap-2 rounded-lg border border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-sidebar-accent)] px-3 py-2 ${
        isDragging ? 'opacity-60' : ''
      }`}
    >
      <button
        type="button"
        className="cursor-grab text-[var(--workspace-shell-text-muted)] hover:text-[var(--workspace-shell-text)]"
        {...attributes}
        {...listeners}
      >
        <GripVertical className="h-4 w-4" />
      </button>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-[var(--workspace-shell-text)]">{field.label}</p>
        <p className="text-xs text-[var(--workspace-shell-text-muted)]">
          {PROJECT_FIELD_TYPE_LABELS[field.fieldType]}
        </p>
      </div>
      {canDelete ? (
        <Button
          type="button"
          size="icon"
          variant="ghost"
          className="h-8 w-8 text-[var(--workspace-shell-text-muted)] hover:text-red-400"
          onClick={onDelete}
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      ) : null}
    </div>
  );
}

export function CampaignManageColumnsDialog({
  open,
  onOpenChange,
  accountId,
  accountSlug,
  projectId,
  fields,
  canEdit,
  onUpdated,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  accountId: string;
  accountSlug: string;
  projectId: string;
  fields: ProjectFieldDefinition[];
  canEdit: boolean;
  onUpdated: () => void;
}) {
  const [localFields, setLocalFields] = useState(fields);
  const [label, setLabel] = useState('');
  const [fieldType, setFieldType] = useState<ProjectFieldType>('text');
  const [choices, setChoices] = useState('');
  const [pending, startTransition] = useTransition();

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));

  useEffect(() => {
    if (open) setLocalFields(fields);
  }, [fields, open]);

  const handleOpenChange = (next: boolean) => {
    onOpenChange(next);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = localFields.findIndex((field) => field.id === active.id);
    const newIndex = localFields.findIndex((field) => field.id === over.id);
    const next = arrayMove(localFields, oldIndex, newIndex);
    setLocalFields(next);

    startTransition(async () => {
      try {
        await reorderProjectFields({
          accountId,
          accountSlug,
          projectId,
          fieldIds: next.map((field) => field.id),
        });
        onUpdated();
      } catch (error) {
        toast.error(error instanceof Error ? error.message : 'Failed to reorder columns');
        setLocalFields(fields);
      }
    });
  };

  const handleAddField = () => {
    if (!label.trim()) {
      toast.error('Column label is required');
      return;
    }

    startTransition(async () => {
      try {
        await createProjectField({
          accountId,
          accountSlug,
          projectId,
          label: label.trim(),
          fieldType,
          options:
            fieldType === 'select'
              ? {
                  choices: choices
                    .split(',')
                    .map((item) => item.trim())
                    .filter(Boolean),
                }
              : {},
        });
        setLabel('');
        setChoices('');
        setFieldType('text');
        toast.success('Column added');
        onUpdated();
      } catch (error) {
        toast.error(error instanceof Error ? error.message : 'Failed to add column');
      }
    });
  };

  const handleDelete = (fieldId: string) => {
    startTransition(async () => {
      try {
        await deleteProjectField({
          accountId,
          accountSlug,
          projectId,
          fieldId,
        });
        toast.success('Column removed');
        onUpdated();
      } catch (error) {
        toast.error(error instanceof Error ? error.message : 'Failed to remove column');
      }
    });
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-h-[85vh] overflow-hidden border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-panel)] text-[var(--workspace-shell-text)] sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Manage columns</DialogTitle>
          <DialogDescription className="text-[var(--workspace-shell-text-muted)]">
            Drag to reorder display columns. Add custom fields with different types.
          </DialogDescription>
        </DialogHeader>

        <div className="max-h-[40vh] space-y-2 overflow-y-auto pr-1">
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
          >
            <SortableContext
              items={localFields.map((field) => field.id)}
              strategy={verticalListSortingStrategy}
            >
              {localFields.map((field) => (
                <SortableFieldRow
                  key={field.id}
                  field={field}
                  canDelete={canEdit}
                  onDelete={() => handleDelete(field.id)}
                />
              ))}
            </SortableContext>
          </DndContext>
        </div>

        {canEdit ? (
          <div className="space-y-3 border-t border-[color:var(--workspace-shell-border)] pt-4">
            <p className="text-sm font-medium text-[var(--workspace-shell-text)]">Add column</p>
            <div>
              <Label className="text-xs text-[var(--workspace-shell-text-muted)]">Label</Label>
              <Input
                value={label}
                onChange={(event) => setLabel(event.target.value)}
                placeholder="e.g. Campaign Status"
                className="mt-1 border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-sidebar-accent)] text-[var(--workspace-shell-text)]"
              />
            </div>
            <div>
              <Label className="text-xs text-[var(--workspace-shell-text-muted)]">Type</Label>
              <Select
                value={fieldType}
                onValueChange={(value) => setFieldType(value as ProjectFieldType)}
              >
                <SelectTrigger className="mt-1 border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-sidebar-accent)] text-[var(--workspace-shell-text)]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="border-[color:var(--workspace-shell-border)] bg-[#1A2535] text-[var(--workspace-shell-text)]">
                  {PROJECT_FIELD_TYPES.map((type) => (
                    <SelectItem key={type} value={type}>
                      {PROJECT_FIELD_TYPE_LABELS[type]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {fieldType === 'select' ? (
              <div>
                <Label className="text-xs text-[var(--workspace-shell-text-muted)]">Options (comma-separated)</Label>
                <Input
                  value={choices}
                  onChange={(event) => setChoices(event.target.value)}
                  placeholder="Option 1, Option 2, Option 3"
                  className="mt-1 border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-sidebar-accent)] text-[var(--workspace-shell-text)]"
                />
              </div>
            ) : null}
            <Button
              type="button"
              disabled={pending}
              className="w-full bg-[var(--ozer-accent)] text-[var(--ozer-white)] hover:bg-[var(--ozer-accent-hover)]"
              onClick={handleAddField}
            >
              <Plus className="mr-2 h-4 w-4" />
              Add column
            </Button>
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
