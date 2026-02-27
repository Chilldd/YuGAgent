/**
 * @fileoverview Context module interface exports
 * @module domain/context/interface
 */

// Export all types from types.ts
export type {
  ContextWindowConfig,
  ContextStats,
  IContextManager,
} from './types.js';

// Export truncation strategy types and classes
export type {
  TruncationResult,
  ITruncationStrategy,
} from './truncation-strategy.js';

export {
  RecentTruncationStrategy,
  LeastRecentTruncationStrategy,
  SmartTruncationStrategy,
  createTruncationStrategy,
} from './truncation-strategy.js';

// Export ContextManager
export { ContextManager } from './manager.js';

// Re-export for convenience
export type { ChatMessage, ToolResult } from '../agent/types.js';
