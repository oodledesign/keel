export type RightmoveFlushRun = {
  id: string;
  startedAt: string;
  completedAt: string | null;
  processed: number;
  succeeded: number;
  failed: number;
  lastError: string | null;
};
