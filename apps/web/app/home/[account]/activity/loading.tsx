import { WorkspaceTablePageSkeleton } from '~/components/workspace-shell/workspace-page-skeletons';

export default function ActivityLoading() {
  return <WorkspaceTablePageSkeleton rows={10} columns={7} />;
}
