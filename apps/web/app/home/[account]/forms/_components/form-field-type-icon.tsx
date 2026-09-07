import type { LucideIcon } from 'lucide-react';
import {
  AlignLeft,
  Calendar,
  CheckSquare,
  ChevronsUpDown,
  CircleDot,
  CloudUpload,
  EyeOff,
  Mail,
  MessageSquare,
  Minus,
  Phone,
  ToggleLeft,
  User,
} from 'lucide-react';

import type { WorkspaceFormFieldType } from '~/lib/workspace-forms/form-fields';

export const WORKSPACE_FORM_FIELD_TYPE_ICONS: Record<
  WorkspaceFormFieldType,
  LucideIcon
> = {
  text: Minus,
  textarea: AlignLeft,
  radio: CircleDot,
  checkbox: CheckSquare,
  select: ChevronsUpDown,
  file: CloudUpload,
  date: Calendar,
  yes_no: ToggleLeft,
  name: User,
  email: Mail,
  phone: Phone,
  message: MessageSquare,
  hidden: EyeOff,
};

export function FormFieldTypeIcon({
  type,
  className = 'h-4 w-4',
}: {
  type: WorkspaceFormFieldType;
  className?: string;
}) {
  const Icon = WORKSPACE_FORM_FIELD_TYPE_ICONS[type];
  return <Icon className={className} aria-hidden />;
}
