/**
 * @fileoverview Agent module interface exports
 * @module domain/agent/interface
 *
 * This file exports all types, interfaces, and classes for the agent module.
 * It serves as the main entry point for importing agent-related functionality.
 */

// Export all types from types.ts
export type {
  ChatMessage,
  ToolCall,
  ToolResult,
  TokenUsage,
  AgentConfig,
  SecurityRule,
  AgentContext,
} from './types.js';

export { MessageRole } from './types.js';

// Export AgentOrchestrator and its interfaces
export {
  AgentOrchestrator,
  type OrchestratorOptions,
  type ProcessingState,
  type ThoughtLoopResult,
} from './orchestrator.js';

// Export constants
export { DEFAULT_SYSTEM_PROMPT, MAX_THOUGHT_ITERATIONS } from './orchestrator.js';
