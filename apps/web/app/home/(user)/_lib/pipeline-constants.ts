/** Synthetic pipeline target id: deal is scoped to a team workspace (account_id), not a businesses row. */
export const PIPELINE_WORKSPACE_BUSINESS_PREFIX = 'workspace:';

export function isPipelineWorkspaceTargetId(id: string): boolean {
  return id.startsWith(PIPELINE_WORKSPACE_BUSINESS_PREFIX);
}

export function pickDefaultPipelineTargetId(
  businesses: Array<{ id: string }>,
  options?: { workspaceScoped?: boolean },
): string {
  if (options?.workspaceScoped) {
    const workspace = businesses.find((b) => isPipelineWorkspaceTargetId(b.id));
    if (workspace) return workspace.id;
  }
  return businesses[0]?.id ?? '';
}
