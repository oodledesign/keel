/** Sentinel value for the personal home workspace in account switchers. */
export const PERSONAL_WORKSPACE_VALUE = '__personal__';

export function isPersonalWorkspaceValue(value: string) {
  return value === PERSONAL_WORKSPACE_VALUE;
}
