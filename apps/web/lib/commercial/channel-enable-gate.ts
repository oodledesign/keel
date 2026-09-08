/**
 * Promise gate for the Channels enable dialog.
 *
 * First settle wins. Dismiss (overlay / Close / Escape) must not run before
 * Continue — that would resolve false and skip publish.
 */
export type ChannelEnableGate = {
  request: () => Promise<boolean>;
  settle: (allowed: boolean) => void;
};

export function createChannelEnableGate(): ChannelEnableGate {
  let resolver: ((allowed: boolean) => void) | null = null;

  return {
    request() {
      return new Promise((resolve) => {
        resolver?.(false);
        resolver = resolve;
      });
    },
    settle(allowed: boolean) {
      const current = resolver;
      resolver = null;
      current?.(allowed);
    },
  };
}

export function channelEnableCanContinue(input: {
  canEnable: boolean;
  extraRequired?: Array<{ severity: string }>;
}): boolean {
  return (
    input.canEnable &&
    (input.extraRequired ?? []).every((item) => item.severity !== 'required')
  );
}
