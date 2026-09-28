import { PageBody } from '@kit/ui/page';
import { Skeleton } from '@kit/ui/skeleton';
import { cn } from '@kit/ui/utils';

const bone = 'bg-[var(--workspace-shell-sidebar-accent)]';
const panel =
  'rounded-2xl border border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-panel)]';

function Bone({ className }: { className?: string }) {
  return <Skeleton className={cn(bone, className)} />;
}

function HeaderSkeleton() {
  return (
    <div className="flex flex-col gap-3">
      <Bone className="h-4 w-28" />
      <div className="flex items-start justify-between gap-3">
        <div className="space-y-2">
          <Bone className="h-6 w-64" />
          <Bone className="h-4 w-32" />
        </div>
        <Bone className="h-9 w-36 rounded-xl" />
      </div>
      <div className="flex gap-4 border-b border-[color:var(--workspace-shell-border)] pb-2">
        <Bone className="h-5 w-20" />
        <Bone className="h-5 w-28" />
        <Bone className="h-5 w-28" />
      </div>
    </div>
  );
}

function OverviewBody() {
  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Bone className="h-11 w-[26rem] max-w-full rounded-xl" />
        <div className="flex items-center gap-1.5">
          <Bone className="mr-2 h-4 w-20" />
          {[0, 1, 2, 3].map((index) => (
            <Bone key={index} className="h-8 w-8 rounded-full" />
          ))}
        </div>
      </div>
      <div className="grid gap-5 xl:grid-cols-2">
        <div className={cn(panel, 'space-y-3 p-5')}>
          <Bone className="h-4 w-32" />
          <Bone className="h-10 w-full" />
          <Bone className="h-4 w-48" />
        </div>
        <div className={cn(panel, 'space-y-3 p-5')}>
          <Bone className="h-4 w-24" />
          <Bone className="h-24 w-full" />
        </div>
      </div>
    </>
  );
}

function ReviewBody() {
  return (
    <div className="flex flex-col gap-4 lg:flex-row">
      <div className={cn(panel, 'w-full space-y-2 p-4 lg:w-[15rem]')}>
        <Bone className="h-4 w-20" />
        <Bone className="mb-3 h-3 w-28" />
        {Array.from({ length: 10 }).map((_, index) => (
          <Bone key={index} className="h-6 w-full" />
        ))}
      </div>
      <div className="min-w-0 flex-1 space-y-5">
        <div className="flex items-center justify-between">
          <Bone className="h-7 w-56" />
          <Bone className="h-8 w-44" />
        </div>
        <div className={cn(panel, 'space-y-3 p-5')}>
          <Bone className="h-4 w-16" />
          <Bone className="h-28 w-full" />
          <Bone className="h-24 w-full" />
        </div>
        <div className={cn(panel, 'space-y-3 p-5')}>
          <Bone className="h-4 w-28" />
          <Bone className="h-36 w-full" />
        </div>
      </div>
      <div className={cn(panel, 'w-full space-y-2 p-4 lg:w-[18rem]')}>
        <Bone className="h-4 w-24" />
        <Bone className="h-8 w-full" />
        {Array.from({ length: 4 }).map((_, index) => (
          <Bone key={index} className="h-14 w-full" />
        ))}
      </div>
    </div>
  );
}

function BuilderBody() {
  return (
    <>
      <div className={cn(panel, 'flex items-center justify-between p-3')}>
        <Bone className="h-5 w-64" />
        <Bone className="h-9 w-72 rounded-xl" />
      </div>
      <div className="grid gap-3 xl:grid-cols-[260px_minmax(0,1fr)_260px]">
        <div className={cn(panel, 'space-y-2 p-3')}>
          {Array.from({ length: 6 }).map((_, index) => (
            <Bone key={index} className="h-8 w-full" />
          ))}
        </div>
        <div className="rounded-2xl border border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-sidebar-accent)] px-3 py-6">
          <div className="mx-auto max-w-[680px] space-y-4 bg-[var(--workspace-shell-panel)] p-6">
            <Bone className="h-7 w-1/2" />
            <Bone className="h-24 w-full" />
            <Bone className="h-40 w-full" />
            <Bone className="h-24 w-full" />
          </div>
        </div>
        <div className={cn(panel, 'space-y-3 p-4')}>
          <Bone className="h-4 w-20" />
          <Bone className="h-9 w-full" />
          <Bone className="h-9 w-full" />
        </div>
      </div>
    </>
  );
}

export function SurveyWorkspaceSkeleton({
  variant,
}: {
  variant: 'overview' | 'review' | 'builder';
}) {
  return (
    <PageBody className="bg-[var(--workspace-shell-canvas)] px-4 py-4 md:px-6 md:py-6">
      <div
        className="animate-in fade-in flex w-full flex-col gap-5 duration-200"
        aria-busy="true"
        aria-label="Loading survey"
      >
        <HeaderSkeleton />
        {variant === 'overview' ? <OverviewBody /> : null}
        {variant === 'review' ? <ReviewBody /> : null}
        {variant === 'builder' ? <BuilderBody /> : null}
      </div>
    </PageBody>
  );
}
