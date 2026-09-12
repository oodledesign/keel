'use client';

import { Plus, Trash2 } from 'lucide-react';

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

import type { WorkspaceFormField } from '~/lib/workspace-forms/form-fields';
import {
  FORM_LOGIC_SUBMIT_TARGET,
  WORKSPACE_FORM_LOGIC_OPS,
  WORKSPACE_FORM_LOGIC_OP_LABELS,
  type WorkspaceFormJumpRule,
  type WorkspaceFormLogicOp,
  createEmptyVisibleWhen,
  createFormJumpRule,
} from '~/lib/workspace-forms/form-logic';
import { workspaceText, workspaceTextMuted } from '~/lib/workspace-ui';

type Props = {
  field: WorkspaceFormField;
  priorFields: WorkspaceFormField[];
  laterFields: WorkspaceFormField[];
  stepsMode: boolean;
  onChange: (patch: Partial<WorkspaceFormField>) => void;
};

export function FormQuestionLogic({
  field,
  priorFields,
  laterFields,
  stepsMode,
  onChange,
}: Props) {
  if (field.type === 'hidden') return null;
  if (priorFields.length === 0 && laterFields.length === 0 && !stepsMode) {
    return null;
  }

  const showWhen = field.visibleWhen;
  const jumpRules = field.jumpRules ?? [];

  return (
    <div
      className="mt-4 space-y-3 rounded-xl border border-[color:var(--workspace-shell-border)] p-3"
      data-test="form-question-logic"
    >
      <p
        className={`text-xs font-medium tracking-wide uppercase ${workspaceTextMuted}`}
      >
        Logic
      </p>

      {priorFields.length > 0 ? (
        <div className="space-y-2">
          <label className={`flex items-center gap-2 text-sm ${workspaceText}`}>
            <input
              type="checkbox"
              checked={Boolean(showWhen)}
              onChange={(event) =>
                onChange({
                  visibleWhen: event.target.checked
                    ? createEmptyVisibleWhen(priorFields[0]?.key ?? '')
                    : undefined,
                })
              }
              data-test="form-logic-show-when-toggle"
            />
            Show this question only when
          </label>
          {showWhen ? (
            <LogicConditionRow
              fields={priorFields}
              op={showWhen.op}
              fieldKey={showWhen.fieldKey}
              value={showWhen.value ?? ''}
              onFieldKey={(fieldKey) =>
                onChange({ visibleWhen: { ...showWhen, fieldKey } })
              }
              onOp={(op) => onChange({ visibleWhen: { ...showWhen, op } })}
              onValue={(value) =>
                onChange({ visibleWhen: { ...showWhen, value } })
              }
            />
          ) : null}
        </div>
      ) : null}

      {stepsMode ? (
        <div className="space-y-2">
          <div className="flex items-center justify-between gap-2">
            <p className={`text-sm ${workspaceText}`}>
              After this answer, go to
            </p>
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={(event) => {
                event.stopPropagation();
                onChange({
                  jumpRules: [...jumpRules, createFormJumpRule()],
                });
              }}
              data-test="form-logic-add-jump"
            >
              <Plus className="mr-1 h-3.5 w-3.5" />
              Add jump
            </Button>
          </div>
          {jumpRules.length === 0 ? (
            <p className={`text-xs ${workspaceTextMuted}`}>
              Optional. Used in Steps — skip ahead or finish early.
            </p>
          ) : (
            jumpRules.map((rule) => (
              <JumpRuleRow
                key={rule.id}
                field={field}
                rule={rule}
                laterFields={laterFields}
                onChange={(next) =>
                  onChange({
                    jumpRules: jumpRules.map((item) =>
                      item.id === rule.id ? next : item,
                    ),
                  })
                }
                onRemove={() =>
                  onChange({
                    jumpRules: jumpRules.filter((item) => item.id !== rule.id),
                  })
                }
              />
            ))
          )}
        </div>
      ) : null}
    </div>
  );
}

function LogicConditionRow({
  fields,
  fieldKey,
  op,
  value,
  onFieldKey,
  onOp,
  onValue,
}: {
  fields: WorkspaceFormField[];
  fieldKey: string;
  op: WorkspaceFormLogicOp;
  value: string;
  onFieldKey: (key: string) => void;
  onOp: (op: WorkspaceFormLogicOp) => void;
  onValue: (value: string) => void;
}) {
  const source = fields.find((field) => field.key === fieldKey);

  return (
    <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_140px_minmax(0,1fr)]">
      <Select value={fieldKey} onValueChange={onFieldKey}>
        <SelectTrigger data-test="form-logic-source-field">
          <SelectValue placeholder="Question" />
        </SelectTrigger>
        <SelectContent>
          {fields.map((field) => (
            <SelectItem key={field.id} value={field.key}>
              {field.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Select
        value={op}
        onValueChange={(next) => onOp(next as WorkspaceFormLogicOp)}
      >
        <SelectTrigger data-test="form-logic-op">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {WORKSPACE_FORM_LOGIC_OPS.map((item) => (
            <SelectItem key={item} value={item}>
              {WORKSPACE_FORM_LOGIC_OP_LABELS[item]}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {op === 'is_answered' ? (
        <p className={`self-center text-xs ${workspaceTextMuted}`}>
          Any answer
        </p>
      ) : source?.options && source.options.length > 0 ? (
        <Select value={value || undefined} onValueChange={onValue}>
          <SelectTrigger data-test="form-logic-value">
            <SelectValue placeholder="Value" />
          </SelectTrigger>
          <SelectContent>
            {source.options.map((option) => (
              <SelectItem key={option} value={option}>
                {option}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      ) : (
        <Input
          value={value}
          placeholder="Value"
          onChange={(event) => onValue(event.target.value)}
          data-test="form-logic-value"
        />
      )}
    </div>
  );
}

function JumpRuleRow({
  field,
  rule,
  laterFields,
  onChange,
  onRemove,
}: {
  field: WorkspaceFormField;
  rule: WorkspaceFormJumpRule;
  laterFields: WorkspaceFormField[];
  onChange: (rule: WorkspaceFormJumpRule) => void;
  onRemove: () => void;
}) {
  return (
    <div className="space-y-2 rounded-lg bg-[var(--workspace-control-surface)] p-2">
      <LogicConditionRow
        fields={[field]}
        fieldKey={field.key}
        op={rule.op}
        value={rule.value ?? ''}
        onFieldKey={() => undefined}
        onOp={(op) => onChange({ ...rule, op })}
        onValue={(value) => onChange({ ...rule, value })}
      />
      <div className="flex items-center gap-2">
        <Label className="sr-only">Then go to</Label>
        <Select
          value={rule.targetKey}
          onValueChange={(targetKey) => onChange({ ...rule, targetKey })}
        >
          <SelectTrigger data-test="form-logic-jump-target">
            <SelectValue placeholder="Go to" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={FORM_LOGIC_SUBMIT_TARGET}>
              Submit the form
            </SelectItem>
            {laterFields.map((item) => (
              <SelectItem key={item.id} value={item.key}>
                {item.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button
          type="button"
          size="icon"
          variant="ghost"
          aria-label="Remove jump"
          onClick={(event) => {
            event.stopPropagation();
            onRemove();
          }}
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
