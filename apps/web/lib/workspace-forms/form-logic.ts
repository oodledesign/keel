import type { WorkspaceFormField } from './form-fields';
import {
  type PublicFormValue,
  type PublicFormValues,
  parseFormFileValue,
} from './form-file';

export const WORKSPACE_FORM_LOGIC_OPS = [
  'equals',
  'not_equals',
  'contains',
  'is_answered',
] as const;

export type WorkspaceFormLogicOp = (typeof WORKSPACE_FORM_LOGIC_OPS)[number];

export const WORKSPACE_FORM_LOGIC_OP_LABELS: Record<
  WorkspaceFormLogicOp,
  string
> = {
  equals: 'Equals',
  not_equals: 'Does not equal',
  contains: 'Contains',
  is_answered: 'Is answered',
};

export const FORM_LOGIC_SUBMIT_TARGET = '_submit';

export type WorkspaceFormVisibleWhen = {
  fieldKey: string;
  op: WorkspaceFormLogicOp;
  value?: string;
};

export type WorkspaceFormJumpRule = {
  id: string;
  op: WorkspaceFormLogicOp;
  value?: string;
  /** Field key to jump to, or `_submit` to skip remaining questions. */
  targetKey: string;
};

export function isFormLogicOp(value: unknown): value is WorkspaceFormLogicOp {
  return (
    typeof value === 'string' &&
    WORKSPACE_FORM_LOGIC_OPS.includes(value as WorkspaceFormLogicOp)
  );
}

export function parseVisibleWhen(
  raw: unknown,
): WorkspaceFormVisibleWhen | undefined {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return undefined;
  const row = raw as Partial<WorkspaceFormVisibleWhen>;
  if (!row.fieldKey || !isFormLogicOp(row.op)) return undefined;
  const next: WorkspaceFormVisibleWhen = {
    fieldKey: String(row.fieldKey).slice(0, 60),
    op: row.op,
  };
  if (typeof row.value === 'string' && row.value.trim()) {
    next.value = row.value.trim().slice(0, 80);
  }
  return next;
}

export function parseJumpRules(
  raw: unknown,
): WorkspaceFormJumpRule[] | undefined {
  if (!Array.isArray(raw)) return undefined;
  const rules = raw.flatMap((item, index) => {
    if (!item || typeof item !== 'object') return [];
    const row = item as Partial<WorkspaceFormJumpRule>;
    if (!isFormLogicOp(row.op) || !row.targetKey) return [];
    const rule: WorkspaceFormJumpRule = {
      id: String(row.id || `jump_${index + 1}`).slice(0, 80),
      op: row.op,
      targetKey: String(row.targetKey).slice(0, 60),
    };
    if (typeof row.value === 'string' && row.value.trim()) {
      rule.value = row.value.trim().slice(0, 80);
    }
    return [rule];
  });
  return rules.length > 0 ? rules.slice(0, 10) : undefined;
}

export function createFormJumpRule(): WorkspaceFormJumpRule {
  return {
    id: `jump_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`,
    op: 'equals',
    value: '',
    targetKey: FORM_LOGIC_SUBMIT_TARGET,
  };
}

export function fieldAnswerText(value: PublicFormValue | undefined): string {
  if (value == null) return '';
  if (typeof value === 'boolean') return value ? 'true' : '';
  const file = parseFormFileValue(value);
  if (file) return file.name;
  if (typeof value === 'string') return value.trim();
  return '';
}

export function isFormValueAnswered(
  value: PublicFormValue | undefined,
): boolean {
  if (value === true) return true;
  if (value === false) return false;
  if (parseFormFileValue(value)) return true;
  return Boolean(fieldAnswerText(value));
}

function normalizeLogicText(value: string): string {
  return value.trim().toLowerCase();
}

function isAffirmativeLogicValue(expected: string): boolean {
  const needle = normalizeLogicText(expected);
  return (
    needle === 'true' || needle === 'yes' || needle === 'on' || needle === '1'
  );
}

export function matchFormLogicCondition(
  value: PublicFormValue | undefined,
  op: WorkspaceFormLogicOp,
  expected?: string,
): boolean {
  const needle = expected?.trim() ?? '';

  if (typeof value === 'boolean') {
    switch (op) {
      case 'is_answered':
        return value;
      case 'equals':
        return isAffirmativeLogicValue(needle) ? value : !value;
      case 'not_equals':
        return isAffirmativeLogicValue(needle) ? !value : value;
      case 'contains':
        return false;
      default:
        return false;
    }
  }

  const answered = isFormValueAnswered(value);
  const text = fieldAnswerText(value);

  switch (op) {
    case 'is_answered':
      return answered;
    case 'equals':
      if (!answered) return false;
      return normalizeLogicText(text) === normalizeLogicText(needle);
    case 'not_equals':
      if (!answered) return false;
      return normalizeLogicText(text) !== normalizeLogicText(needle);
    case 'contains':
      if (!answered || !needle) return false;
      return normalizeLogicText(text).includes(normalizeLogicText(needle));
    default:
      return false;
  }
}

/**
 * Visible public fields given current answers. `visibleWhen` may only
 * reference an earlier field (by definition order) so chains cannot cycle.
 */
export function visibleFieldsForValues(
  fields: WorkspaceFormField[],
  values: PublicFormValues,
): WorkspaceFormField[] {
  const visibleKeys = new Set<string>();
  const visible: WorkspaceFormField[] = [];

  for (const field of fields) {
    if (field.type === 'hidden') continue;
    const rule = field.visibleWhen;
    if (rule) {
      if (!visibleKeys.has(rule.fieldKey)) continue;
      if (
        !matchFormLogicCondition(values[rule.fieldKey], rule.op, rule.value)
      ) {
        continue;
      }
    }
    visibleKeys.add(field.key);
    visible.push(field);
  }

  return visible;
}

export function resolveStepJumpTarget(input: {
  stepFields: WorkspaceFormField[];
  values: PublicFormValues;
}): string | null {
  for (const field of input.stepFields) {
    for (const rule of field.jumpRules ?? []) {
      if (
        matchFormLogicCondition(input.values[field.key], rule.op, rule.value)
      ) {
        return rule.targetKey;
      }
    }
  }
  return null;
}

export function findVisibleFieldStepIndex(
  steps: Array<{ kind: string; fields?: WorkspaceFormField[] }>,
  targetKey: string,
): number | null {
  if (targetKey === FORM_LOGIC_SUBMIT_TARGET) return null;
  const index = steps.findIndex(
    (step) =>
      step.kind === 'fields' &&
      step.fields?.some((field) => field.key === targetKey),
  );
  return index >= 0 ? index : null;
}

export function createEmptyVisibleWhen(
  fieldKey: string,
): WorkspaceFormVisibleWhen {
  return {
    fieldKey,
    op: 'equals',
    value: '',
  };
}
