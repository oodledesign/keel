'use client';

import { type CSSProperties, useEffect, useRef, useState } from 'react';

import { cn } from '@kit/ui/utils';

import { loadWaveformPeaks } from '~/lib/videos/audio-waveform.client';
import { type VideoKeepRange, isTimeKept } from '~/lib/videos/edit-timeline';

type Props = {
  masterUrl: string | null;
  sourceDurationMs: number;
  keepRanges: VideoKeepRange[];
  className?: string;
};

export function TimelineWaveform(props: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [peaks, setPeaks] = useState<number[] | null>(null);
  const [status, setStatus] = useState<'idle' | 'loading' | 'ready' | 'empty'>(
    'idle',
  );

  useEffect(() => {
    if (!props.masterUrl) {
      setPeaks(null);
      setStatus('idle');
      return;
    }

    const controller = new AbortController();
    setStatus('loading');
    setPeaks(null);

    void loadWaveformPeaks(props.masterUrl, 720, controller.signal).then(
      (result) => {
        if (controller.signal.aborted) return;
        if (!result.ok) {
          setPeaks(null);
          setStatus('empty');
          return;
        }
        setPeaks(result.peaks);
        setStatus(result.hasSignal ? 'ready' : 'empty');
      },
    );

    return () => controller.abort();
  }, [props.masterUrl]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container || !peaks?.length) return;

    const draw = () => {
      const width = Math.max(1, container.clientWidth);
      const height = Math.max(1, container.clientHeight);
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      canvas.width = Math.floor(width * dpr);
      canvas.height = Math.floor(height * dpr);
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;

      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, width, height);

      const mid = height / 2;
      const barGap = 0.5;
      const barW = width / peaks.length;
      const duration = Math.max(1, props.sourceDurationMs);

      const kept =
        getComputedStyle(container).getPropertyValue('--waveform-kept');
      const cut =
        getComputedStyle(container).getPropertyValue('--waveform-cut');
      const keptColor = kept.trim() || 'rgba(255, 92, 52, 0.7)';
      const cutColor = cut.trim() || 'rgba(183, 164, 172, 0.35)';

      for (let i = 0; i < peaks.length; i++) {
        const tMs = ((i + 0.5) / peaks.length) * duration;
        const amp = peaks[i] ?? 0;
        const h = Math.max(1, amp * (height * 0.44));
        ctx.fillStyle = isTimeKept(props.keepRanges, tMs)
          ? keptColor
          : cutColor;
        ctx.fillRect(i * barW, mid - h, Math.max(1, barW - barGap), h * 2);
      }
    };

    draw();
    const observer = new ResizeObserver(() => draw());
    observer.observe(container);
    return () => observer.disconnect();
  }, [peaks, props.keepRanges, props.sourceDurationMs]);

  return (
    <div
      ref={containerRef}
      className={cn('pointer-events-none absolute inset-0', props.className)}
      style={
        {
          '--waveform-kept':
            'color-mix(in oklab, var(--ozer-accent) 70%, transparent)',
          '--waveform-cut':
            'color-mix(in oklab, var(--workspace-shell-text-muted) 35%, transparent)',
        } as CSSProperties
      }
      aria-hidden
    >
      <canvas ref={canvasRef} className="h-full w-full" />
      {status === 'loading' ? (
        <span className="absolute inset-x-0 top-1/2 -translate-y-1/2 text-center text-[10px] text-[var(--workspace-shell-text-muted)]">
          Loading waveform…
        </span>
      ) : null}
      {status === 'empty' ? (
        <span className="absolute inset-x-0 top-1/2 -translate-y-1/2 text-center text-[10px] text-[var(--workspace-shell-text-muted)]">
          No audio detected in master
        </span>
      ) : null}
    </div>
  );
}
