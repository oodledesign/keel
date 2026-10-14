import { cn } from '@kit/ui/utils';

type IgWaveformProps = {
  peaks: number[] | null | undefined;
  /** 0–1 playback progress; bars before it are highlighted. */
  progress?: number;
  className?: string;
  barClassName?: string;
};

export function IgWaveform({
  peaks,
  progress = 0,
  className,
  barClassName,
}: IgWaveformProps) {
  const bars = peaks?.length ? peaks : Array.from({ length: 32 }, () => 0.15);

  return (
    <div
      className={cn('flex h-8 items-center gap-[2px]', className)}
      aria-hidden
    >
      {bars.map((peak, index) => {
        const played = index / bars.length < progress;
        return (
          <span
            key={index}
            className={cn(
              'w-[3px] shrink-0 rounded-full transition-colors',
              played
                ? 'bg-[var(--ozer-accent)]'
                : 'bg-[var(--workspace-shell-text-muted)] opacity-60',
              barClassName,
            )}
            style={{ height: `${Math.max(12, Math.round(peak * 100))}%` }}
          />
        );
      })}
    </div>
  );
}
