import { cn } from '@kit/ui/utils';

import {
  TASK_STATUS_PILL_CHROME,
  resolveTaskStatusTone,
  taskStatusBadgeClass,
  taskStatusDisplayLabel,
} from '~/lib/projects/task-status-badge';

export function TaskStatusBadge({
  status,
  label,
  className,
}: {
  status: string;
  label?: string;
  className?: string;
}) {
  const text = taskStatusDisplayLabel(status, label);
  const tone = resolveTaskStatusTone(status, text);

  return (
    <span
      data-test={`task-status-${tone}`}
      className={cn(
        TASK_STATUS_PILL_CHROME,
        taskStatusBadgeClass(status, text),
        className,
      )}
    >
      {text}
    </span>
  );
}
