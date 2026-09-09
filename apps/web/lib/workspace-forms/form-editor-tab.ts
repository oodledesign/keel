export const FORM_EDITOR_TAB_IDS = [
  'submissions',
  'builder',
  'settings',
  'notifications',
  'share',
] as const;

export type FormEditorTab = (typeof FORM_EDITOR_TAB_IDS)[number];

export const DEFAULT_FORM_EDITOR_TAB: FormEditorTab = 'submissions';

export const FORM_EDITOR_TAB_QUERY = 'tab';

export function isFormEditorTab(
  value: string | null | undefined,
): value is FormEditorTab {
  return (
    typeof value === 'string' &&
    (FORM_EDITOR_TAB_IDS as readonly string[]).includes(value)
  );
}

export function parseFormEditorTab(
  value: string | null | undefined,
): FormEditorTab {
  return isFormEditorTab(value) ? value : DEFAULT_FORM_EDITOR_TAB;
}

export function formEditorTabSearchParams(
  tab: FormEditorTab,
  current?: URLSearchParams | string | null,
): URLSearchParams {
  const params = new URLSearchParams(current?.toString() ?? '');
  params.set(FORM_EDITOR_TAB_QUERY, tab);
  return params;
}

export function formEditorTabHref(
  pathname: string,
  tab: FormEditorTab,
  current?: URLSearchParams | string | null,
): string {
  const params = formEditorTabSearchParams(tab, current);
  const query = params.toString();
  return query ? `${pathname}?${query}` : pathname;
}
