import { WorkspaceTablePageSkeleton } from '~/components/workspace-shell/workspace-page-skeletons';

export default function TasksLoading() {
  return <WorkspaceTablePageSkeleton rows={12} columns={4} />;
}
