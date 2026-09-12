import { isValidFormNotifyEmail } from './form-email';
import type { WorkspaceFormField } from './form-fields';
import {
  type PublicFormValue,
  type PublicFormValues,
  isFormUploadPathForForm,
  parseFormFileValue,
} from './form-file';
import { visibleFieldsForValues } from './form-logic';

export function isWorkspaceFormFieldAnswered(
  field: WorkspaceFormField,
  value: PublicFormValue | undefined,
): boolean {
  if (field.type === 'hidden') {
    return true;
  }
  if (field.type === 'file') {
    return Boolean(parseFormFileValue(value));
  }
  if (field.type === 'checkbox') {
    return value === true;
  }
  if (typeof value === 'boolean') {
    return value;
  }
  if (typeof value === 'string') {
    return Boolean(value.trim());
  }
  return false;
}

const DATE_VALUE_RE = /^\d{4}-\d{2}-\d{2}$/;

export function validateWorkspaceFormField(
  field: WorkspaceFormField,
  value: PublicFormValue | undefined,
): string | null {
  const answered = isWorkspaceFormFieldAnswered(field, value);

  if (field.required && !answered) {
    return `Please answer ${field.label}.`;
  }

  if (!answered) return null;

  if (field.type === 'email' && typeof value === 'string') {
    if (!isValidFormNotifyEmail(value)) {
      return 'Please enter a valid email.';
    }
  }

  if (field.type === 'date' && typeof value === 'string') {
    if (!DATE_VALUE_RE.test(value.trim())) {
      return 'Please enter a valid date.';
    }
  }

  if (
    (field.type === 'select' ||
      field.type === 'radio' ||
      field.type === 'yes_no') &&
    field.options &&
    field.options.length > 0 &&
    typeof value === 'string' &&
    !field.options.includes(value)
  ) {
    return 'Please choose one of the available options.';
  }

  if (field.type === 'file') {
    const file = parseFormFileValue(value);
    if (!file) {
      return field.required
        ? `Please upload a file for ${field.label}.`
        : 'That upload is no longer valid. Please choose the file again.';
    }
  }

  return null;
}

export function validateVisibleFormFields(
  fields: WorkspaceFormField[],
  values: PublicFormValues,
  options?: { singleQuestion?: boolean },
): string | null {
  const visible = visibleFieldsForValues(fields, values);
  for (const field of visible) {
    const error = validateWorkspaceFormField(field, values[field.key]);
    if (!error) continue;
    if (options?.singleQuestion && visible.length === 1) {
      if (error.startsWith('Please answer')) {
        return 'Please answer this question.';
      }
    }
    return error;
  }
  return null;
}

export function sanitizePublicFormValues(input: {
  fields: WorkspaceFormField[];
  values: PublicFormValues;
  accountId?: string;
  formId?: string;
}): PublicFormValues {
  const allowed = new Map(input.fields.map((field) => [field.key, field]));
  const visibleKeys = new Set(
    visibleFieldsForValues(input.fields, input.values).map(
      (field) => field.key,
    ),
  );
  const next: PublicFormValues = {};

  for (const [key, raw] of Object.entries(input.values)) {
    const field = allowed.get(key);
    if (!field) continue;
    if (field.type !== 'hidden' && !visibleKeys.has(key)) continue;

    if (field.type === 'file') {
      const file = parseFormFileValue(raw);
      if (!file) continue;
      if (
        input.accountId &&
        input.formId &&
        !isFormUploadPathForForm(file.path, input.accountId, input.formId)
      ) {
        continue;
      }
      next[key] = file;
      continue;
    }

    if (typeof raw === 'boolean') {
      next[key] = raw;
      continue;
    }

    if (typeof raw === 'string') {
      next[key] = raw;
    }
  }

  return next;
}
