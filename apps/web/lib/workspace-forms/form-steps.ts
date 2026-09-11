/**
 * Client-safe helpers for Typeform-style public form steps.
 * Field order is the step order. Hidden fields are skipped.
 */
import { type WorkspaceFormField, publicVisibleFields } from './form-fields';
import type { WorkspaceFormLayout } from './form-theme';

export type PublicFormWelcomeStep = {
  kind: 'welcome';
};

export type PublicFormFieldStep = {
  kind: 'field';
  field: WorkspaceFormField;
};

export type PublicFormStep = PublicFormWelcomeStep | PublicFormFieldStep;

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
  for (const field of publicVisibleFields(input.fields)) {
    steps.push({ kind: 'field', field });
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
  if (!step.field.required) return null;
  if (isWorkspaceFormFieldAnswered(step.field, values[step.field.key])) {
    return null;
  }
  return 'Please answer this question.';
}
