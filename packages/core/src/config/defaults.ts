// @airmcp-dev/core — config/defaults.ts

import type { AirConfig } from '../types/config.js';

export const DEFAULT_CONFIG: Required<
  Pick<AirConfig, 'version' | 'transport' | 'storage' | 'logging' | 'metrics' | 'dev'>
> = {
  version: '0.1.0',
  transport: { type: 'auto' },
  storage: { type: 'memory' },
  logging: { level: 'info', format: 'pretty' },
  metrics: { enabled: true, layerClassification: false },
  dev: { hotReload: true, port: 3100 },
};
