/**
 * @fileoverview Memory module interface exports
 * @module domain/memory/interface
 */

// Export all types from types.ts
export type {
  MemoryEntry,
  MemoryRetrievalOptions,
  MemoryStats,
  IMemoryManager,
} from './types.js';

export { MemoryType } from './types.js';

// Export TokenCounter and its interfaces
export { TokenCounter } from './token-counter.js';
export type { TokenCountResult } from './token-counter.js';

// Export SessionStore
export { SessionStore } from './session-store.js';

// Export MemoryManager and its interfaces
export { MemoryManager } from './manager.js';
export type { TokenStats } from './manager.js';

// Re-export for convenience
export type { ChatMessage } from '../agent/types.js';
