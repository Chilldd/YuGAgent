/**
 * @fileoverview Model Provider module barrel export
 * @module infrastructure/model-provider
 */

// ============== Interface & Types ==============
export {
  type IModelProvider,
  type ITokenCounter,
  type ModelCompleteRequest,
  type ModelCompleteResponse,
  type StreamChunk,
  type ToolDefinition,
  type ToolCall,
  type HealthCheckResult,
  type ModelProviderConfig,
} from './interface.js';

// ============== Registry ==============
export {
  ModelProviderRegistry,
  modelProviderRegistry,
  ProviderType,
} from './registry.js';

// ============== Zhipu Provider ==============
export {
  type ZhipuConfig,
  getZhipuConfig,
  getZhipuConfigWithOverrides,
  validateZhipuConfig,
  createZhipuConfig,
} from './zhipu/config.js';

export { ZhipuModelProvider } from './zhipu/adapter.js';
