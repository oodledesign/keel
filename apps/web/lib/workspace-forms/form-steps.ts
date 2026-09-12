/**
 * Client-safe helpers for Typeform-style public form steps.
 * Visible field order is the step order. Hidden fields are skipped.
 * `stepBreakAfter !== false` (the default) starts a new step after that field.
 */
import { type WorkspaceFormField, publicVisibleFields } from './form-fields';
import type { WorkspaceFormLayout } from './form-theme';

export type PublicFormWelcomeStep = {
  kind: 'welcome';
};

export type PublicFormFieldsStep = {
  kind: 'fields';
  fields: WorkspaceFormField[];
};

export type PublicFormStep = PublicFormWelcomeStep | PublicFormFieldsStep;

export function fieldHasStepBreakAfter(field: WorkspaceFormField): boolean {
  return field.stepBreakAfter !== false;
}

export function groupVisibleFieldsIntoSteps(
  fields: WorkspaceFormField[],
): WorkspaceFormField[][] {
  const groups: WorkspaceFormField[][] = [];
  let current: WorkspaceFormField[] = [];

  for (const field of publicVisibleFields(fields)) {
    current.push(field);
    if (fieldHasStepBreakAfter(field)) {
      groups.push(current);
      current = [];
    }
  }

  if (current.length > 0) {
    groups.push(current);
  }

  return groups;
}

export function visibleFieldStepNumberById(
  fields: WorkspaceFormField[],
): Map<string, number> {
  const map = new Map<string, number>();
  groupVisibleFieldsIntoSteps(fields).forEach((group, index) => {
    for (const field of group) {
      map.set(field.id, index + 1);
    }
  });
  return map;
}

export function setFieldStepBreakAfter(
  fields: WorkspaceFormField[],
  fieldId: string,
  stepBreakAfter: boolean,
): WorkspaceFormField[] {
  return fields.map((field) =>
    field.id === fieldId ? { ...field, stepBreakAfter } : field,
  );
}

export function shouldIncludeWelcomeStep(input: {
  presentation: 'classic' | 'steps';
  layout: WorkspaceFormLayout;
  embed?: boolean;
  hasIntro: boolean;
}): boolean {
  if (input.presentation !== 'steps') return false;
  if (input.embed) return false;
  // Event / two-column already shows intro beside the form.
  if (input.layout === 'event') return false;
  return input.hasIntro;
}

export function buildPublicFormSteps(input: {
  fields: WorkspaceFormField[];
  includeWelcome?: boolean;
}): PublicFormStep[] {
  const steps: PublicFormStep[] = [];
  if (input.includeWelcome) {
    steps.push({ kind: 'welcome' });
  }
  for (const group of groupVisibleFieldsIntoSteps(input.fields)) {
    steps.push({ kind: 'fields', fields: group });
  }
  return steps;
}

export function isWorkspaceFormFieldAnswered(
  field: WorkspaceFormField,
  value: string | boolean | undefined,
): boolean {
  if (field.type === 'hidden' || field.type === 'file') {
    return true;
  }
  if (field.type === 'checkbox') {
    return value === true;
  }
  if (typeof value === 'boolean') {
    return value;
  }
  return Boolean(value?.toString().trim());
}

export function validatePublicFormStep(
  step: PublicFormStep,
  values: Record<string, string | boolean>,
): string | null {
  if (step.kind === 'welcome') return null;

  for (const field of step.fields) {
    if (!field.required) continue;
    if (isWorkspaceFormFieldAnswered(field, values[field.key])) continue;
    return step.fields.length > 1
      ? `Please answer ${field.label}.`
      : 'Please answer this question.';
  }

  return null;
}
