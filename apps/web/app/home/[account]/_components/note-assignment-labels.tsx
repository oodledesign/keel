import { cn } from '@kit/ui/utils';

type NoteAssignmentLabelsProps = {
  clientName: string | null;
  projectName: string | null;
  className?: string;
};

export function NoteAssignmentLabels({
  clientName,
  projectName,
  className,
}: NoteAssignmentLabelsProps) {
  if (!clientName && !projectName) {
    return null;
  }

  return (
    <div className={cn('min-w-0 max-w-[55%] text-right', className)}>
      {clientName ? (
        <span
          className="block truncate text-[10px] font-medium text-[var(--workspace-shell-text)]"
          title={clientName}
        >
          {clientName}
        </span>
      ) : null}
      {projectName ? (
        <span
          className="block truncate text-[10px] text-[var(--workspace-shell-text-muted)]"
          title={projectName}
        >
          {projectName}
        </span>
      ) : null}
    </div>
  );
}
