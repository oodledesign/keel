/**
 * Client-safe helpers for Typeform-style public form steps.
 * Visible field order is the step order. Hidden fields are skipped.
 * `stepBreakAfter !== false` (the default) starts a new step after that field.
 */
import { type WorkspaceFormField, publicVisibleFields } from './form-fields';
import { type PublicFormValues } from './form-file';
import { visibleFieldsForValues } from './form-logic';
import type { WorkspaceFormLayout } from './form-theme';
import {
  isWorkspaceFormFieldAnswered,
  validateWorkspaceFormField,
} from './form-validate';

export { isWorkspaceFormFieldAnswered };

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
  values?: PublicFormValues;
}): PublicFormStep[] {
  const steps: PublicFormStep[] = [];
  if (input.includeWelcome) {
    steps.push({ kind: 'welcome' });
  }
  const groups = input.values
    ? groupVisibleFieldsIntoSteps(
        visibleFieldsForValues(input.fields, input.values),
      )
    : groupVisibleFieldsIntoSteps(input.fields);
  for (const group of groups) {
    steps.push({ kind: 'fields', fields: group });
  }
  return steps;
}

export function validatePublicFormStep(
  step: PublicFormStep,
  values: PublicFormValues,
): string | null {
  if (step.kind === 'welcome') return null;

  for (const field of step.fields) {
    const error = validateWorkspaceFormField(field, values[field.key]);
    if (!error) continue;
    if (
      step.fields.length === 1 &&
      step.fields[0]?.type !== 'file' &&
      error.startsWith('Please answer')
    ) {
      return 'Please answer this question.';
    }
    return error;
  }

  return null;
}
