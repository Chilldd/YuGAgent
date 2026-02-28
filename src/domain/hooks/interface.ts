/**
 * @fileoverview Hooks module interface exports
 * @module domain/hooks/interface
 *
 * This file exports all types, interfaces, and classes for the hooks module.
 * It serves as the main entry point for importing hooks-related functionality.
 */

// Types from types.ts
export type {
  HookHandler,
  HookOptions,
  HookContext,
  HookEntry,
} from './types.js';

export type {
  IHooksManager,
} from './types.js';

export {
  HookEvent,
} from './types.js';

// Classes and utilities from middleware-chain.ts
export {
  MiddlewareChain,
  compose,
  type MiddlewareFunction,
  type MiddlewareChainOptions,
} from './middleware-chain.js';

// Class from manager.ts
export { HooksManager } from './manager.js';
