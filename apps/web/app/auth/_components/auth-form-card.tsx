import { cn } from '@kit/ui/utils';

/** Narrow single-column card for sign-in, password reset, and similar. */
export function AuthFormCard({
  children,
  className,
}: React.PropsWithChildren<{ className?: string }>) {
  return (
    <div
      className={cn(
        'flex w-full max-w-[24rem] flex-col gap-y-6 rounded-2xl border border-[color:var(--ozer-border-on-light)] bg-[var(--ozer-white)] px-6 py-8 shadow-[0_16px_48px_var(--ozer-plum-alpha-12)] md:px-8',
        className,
      )}
    >
      {children}
    </div>
  );
}
