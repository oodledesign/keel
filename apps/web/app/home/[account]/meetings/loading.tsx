import { WorkspaceTablePageSkeleton } from '~/components/workspace-shell/workspace-page-skeletons';

export default function MeetingsLoading() {
  return <WorkspaceTablePageSkeleton rows={8} columns={4} />;
}
