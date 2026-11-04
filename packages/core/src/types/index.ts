// @airmcp-dev/core — types/index.ts (re-export only)

export type { AirConfig, ShieldConfig, MeterConfig, GatewayRegistrationConfig } from './config.js';
export type { TransportType, TransportConfig } from './transport.js';
export type {
  ParamShorthand,
  AirToolParams,
  AirToolHandler,
  AirToolContext,
  AirToolResponse,
  AirToolDef,
  AirToolAnnotations,
  AirElicitSchema,
  AirElicitJsonSchema,
  AirLogLevel,
  AirElicitResult,
  AirResourceLink,
} from './tool.js';
export type { AirResourceDef, AirResourceContext, AirResourceContent } from './resource.js';
export type { AirPromptDef, AirPromptArg, AirPromptMessage, AirPromptContent } from './prompt.js';
export type {
  MiddlewareContext,
  MiddlewareResult,
  BeforeMiddleware,
  AfterMiddleware,
  ErrorMiddleware,
  AirMiddleware,
} from './middleware.js';
export type { StorageAdapter, QueryOptions, StoreOptions } from './storage.js';
export type {
  AirPluginMeta,
  PluginHooks,
  PluginContext,
  AirPlugin,
  AirPluginFactory,
} from './plugin.js';
export type {
  AirPluginManifest,
  PluginCategory,
  PluginRegistryEntry,
  PluginRegistryConfig,
} from './plugin-manifest.js';
export { DEFAULT_REGISTRY_URL } from './plugin-manifest.js';
export type { AirServerOptions, AirServer, AirServerStatus } from './server.js';
