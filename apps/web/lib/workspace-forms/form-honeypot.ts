/** Public form honeypot field name. Bots fill it; humans leave it empty. */
export const PUBLIC_FORM_HONEYPOT_FIELD = 'website';

export function isPublicFormHoneypotFilled(
  value: string | null | undefined,
): boolean {
  return Boolean(value?.trim());
}
