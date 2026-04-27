import { ensureDiagnosticsChannelCompatibility } from './polyfills/diagnostics';
import { config } from './config';

async function start() {
  try {
    ensureDiagnosticsChannelCompatibility();
    const { buildApp } = await import('./app.js');
    const app = await buildApp();

    await app.listen({
      port: config.port,
      host: config.host,
    });

    const close = async () => {
      app.log.info('Shutting down...');
      try {
        await app.close();
        process.exit(0);
      } catch (err) {
        app.log.error({ err }, 'Error during shutdown');
        process.exit(1);
      }
    };

    process.on('SIGTERM', close);
    process.on('SIGINT', close);
  } catch (err) {
    console.error('Failed to start server', err);
    process.exit(1);
  }
}

start();
