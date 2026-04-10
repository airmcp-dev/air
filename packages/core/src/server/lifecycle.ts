// @airmcp-dev/core — server/lifecycle.ts
// Graceful shutdown + 시그널 핸들링

let shutdownHandlers: Array<() => Promise<void>> = [];
let registered = false;

export function onShutdown(handler: () => Promise<void>) {
  shutdownHandlers.push(handler);
  registerSignals();
}

export function clearShutdownHandlers() {
  shutdownHandlers = [];
}

function registerSignals() {
  if (registered) return;
  registered = true;

  const shutdown = async (signal: string) => {
    console.log(`\n[air] ${signal} received — shutting down...`);
    for (const handler of shutdownHandlers) {
      try {
        await handler();
      } catch (err: any) {
        console.error(`[air] Shutdown error: ${err.message}`);
      }
    }
    process.exit(0);
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}
