import 'server-only';

export type JobProgressEvent = {
  status: string;
  error_msg?: string | null;
  done?: boolean;
  [key: string]: unknown;
};

type StreamOptions = {
  intervalMs?: number;
  maxTicks?: number;
};

export function createJobSseResponse(
  loadProgress: () => Promise<JobProgressEvent | null>,
  options?: StreamOptions,
): Response {
  const intervalMs = options?.intervalMs ?? 1500;
  const maxTicks = options?.maxTicks ?? 180;
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      const send = (payload: JobProgressEvent) => {
        controller.enqueue(
          encoder.encode(`data: ${JSON.stringify(payload)}\n\n`),
        );
      };

      let lastSignature = '';
      let ticks = 0;

      try {
        while (ticks < maxTicks) {
          ticks += 1;
          const payload = await loadProgress();

          if (!payload) {
            send({ status: 'error', error_msg: 'Job not found', done: true });
            break;
          }

          const signature = JSON.stringify({
            status: payload.status,
            error_msg: payload.error_msg ?? null,
            done: payload.done ?? false,
          });

          if (signature !== lastSignature) {
            lastSignature = signature;
            send(payload);
          }

          if (
            payload.done ||
            payload.status === 'done' ||
            payload.status === 'error'
          ) {
            break;
          }

          await new Promise((resolve) => setTimeout(resolve, intervalMs));
        }
      } catch (error) {
        send({
          status: 'error',
          error_msg:
            error instanceof Error ? error.message : 'Stream interrupted',
          done: true,
        });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
    },
  });
}
