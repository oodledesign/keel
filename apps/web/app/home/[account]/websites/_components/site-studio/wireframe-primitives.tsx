'use client';

import { cn } from '@kit/ui/utils';

/** Forced light monochrome — Relume-style wireframes ignore app theme. */
export const wf = {
  canvas: 'bg-neutral-100 text-neutral-900',
  panel: 'bg-white',
  muted: 'text-neutral-500',
  border: 'border-neutral-300',
  fill: 'bg-neutral-200',
  fillDark: 'bg-neutral-300',
  ink: 'text-neutral-900',
} as const;

const editableBase =
  'w-full rounded-sm border border-transparent bg-transparent px-0.5 py-0.5 outline-none transition-colors placeholder:text-neutral-400 focus:border-neutral-400 focus:bg-white/80';

export function WfImage({
  className,
  label = 'Image',
}: {
  className?: string;
  label?: string;
}) {
  return (
    <div
      className={cn(
        'flex items-center justify-center border border-dashed border-neutral-300 bg-neutral-200 text-[11px] font-medium uppercase tracking-wide text-neutral-500',
        className,
      )}
    >
      {label}
    </div>
  );
}

export function WfText({
  value,
  onChange,
  canEdit,
  placeholder,
  className,
  multiline = false,
  rows = 2,
}: {
  value: string;
  onChange?: (value: string) => void;
  canEdit: boolean;
  placeholder?: string;
  className?: string;
  multiline?: boolean;
  rows?: number;
}) {
  if (!canEdit) {
    return (
      <p className={cn('whitespace-pre-wrap', className)}>
        {value || placeholder}
      </p>
    );
  }

  if (multiline) {
    return (
      <textarea
        value={value}
        rows={rows}
        placeholder={placeholder}
        onChange={(event) => onChange?.(event.target.value)}
        className={cn(editableBase, 'resize-none', className)}
      />
    );
  }

  return (
    <input
      type="text"
      value={value}
      placeholder={placeholder}
      onChange={(event) => onChange?.(event.target.value)}
      className={cn(editableBase, className)}
    />
  );
}

export function WfButton({
  value,
  onChange,
  canEdit,
  variant = 'primary',
  className,
}: {
  value: string;
  onChange?: (value: string) => void;
  canEdit: boolean;
  variant?: 'primary' | 'secondary';
  className?: string;
}) {
  const shell =
    variant === 'primary'
      ? 'border-neutral-900 bg-neutral-900 text-white'
      : 'border-neutral-900 bg-white text-neutral-900';

  if (!canEdit) {
    return (
      <span
        className={cn(
          'inline-flex min-h-9 items-center justify-center rounded-md border px-4 text-sm font-medium',
          shell,
          className,
        )}
      >
        {value || 'Button'}
      </span>
    );
  }

  return (
    <input
      type="text"
      value={value}
      onChange={(event) => onChange?.(event.target.value)}
      className={cn(
        'inline-flex min-h-9 min-w-[7rem] items-center justify-center rounded-md border px-4 text-center text-sm font-medium outline-none focus:ring-1 focus:ring-neutral-900',
        shell,
        className,
      )}
    />
  );
}

export function WfField({
  label,
  canEdit,
  onLabelChange,
}: {
  label: string;
  canEdit: boolean;
  onLabelChange?: (value: string) => void;
}) {
  return (
    <div className="space-y-1.5">
      <WfText
        value={label}
        canEdit={canEdit}
        onChange={onLabelChange}
        className="text-xs font-medium text-neutral-500"
      />
      <div className="h-9 rounded-md border border-neutral-300 bg-white" />
    </div>
  );
}

export function WfSectionFrame({
  children,
  className,
  padded = true,
}: {
  children: React.ReactNode;
  className?: string;
  padded?: boolean;
}) {
  return (
    <div
      className={cn(
        wf.canvas,
        'overflow-hidden rounded-lg border border-neutral-300',
        padded && 'p-5 md:p-7',
        className,
      )}
    >
      {children}
    </div>
  );
}
