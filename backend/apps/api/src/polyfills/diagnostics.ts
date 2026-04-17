import diagnosticsChannel from 'node:diagnostics_channel';

export function ensureDiagnosticsChannelCompatibility(): void {
  const diagnostics = diagnosticsChannel as typeof diagnosticsChannel & {
    tracingChannel?: unknown;
  };

  if (typeof diagnostics.tracingChannel === 'function') {
    return;
  }

  diagnostics.tracingChannel = ((name: string) => {
    void name;
    return (
    ({
      traceSync<T>(fn: () => T): T {
        return fn();
      },
      async tracePromise<T>(fn: () => Promise<T>): Promise<T> {
        return await fn();
      },
      publish() {},
      hasSubscribers: false
    }) as unknown
    );
  }) as typeof diagnostics.tracingChannel;
}
