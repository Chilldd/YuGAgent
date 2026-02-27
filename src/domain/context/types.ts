/**
 * @fileoverview Domain types for Context management
 * @module domain/context/types
 */

import type { ChatMessage } from '../agent/types.js';

/**
 * Context window configuration
 */
export interface ContextWindowConfig {
  /** Maximum number of messages to keep in context */
  maxMessages: number;
  /** Maximum tokens allowed in the context window */
  maxTokens: number;
  /** Strategy to use when truncating context */
  truncationStrategy: 'oldest' | 'least-recent' | 'smart';
}

/**
 * Context statistics
 */
export interface ContextStats {
  /** Current number of messages in context */
  messageCount: number;
  /** Estimated current token count */
  estimatedTokens: number;
  /** Percentage of context window used */
  utilizationPercent: number;
}

/**
 * Context manager interface for handling conversation context
 */
export interface IContextManager {
  /**
   * Add a message to the context
   * @param message - The message to add
   */
  addMessage(message: ChatMessage): void;

  /**
   * Get all messages in the current context
   * @returns Array of messages
   */
  getMessages(): ChatMessage[];

  /**
   * Get messages within a specific range
   * @param start - Start index (inclusive)
   * @param end - End index (exclusive)
   * @returns Array of messages in the range
   */
  getMessageRange(start: number, end: number): ChatMessage[];

  /**
   * Clear all messages from context
   */
  clear(): void;

  /**
   * Get current context statistics
   * @returns Context statistics
   */
  getStats(): ContextStats;

  /**
   * Truncate context according to the configured strategy
   * @param targetSize - Target number of messages after truncation
   */
  truncate(targetSize?: number): void;

  /**
   * Set the context window configuration
   * @param config - Configuration options
   */
  setConfig(config: Partial<ContextWindowConfig>): void;

  /**
   * Get the current context window configuration
   * @returns Current configuration
   */
  getConfig(): ContextWindowConfig;

  /**
   * Check if context needs truncation
   * @returns True if context exceeds limits
   */
  needsTruncation(): boolean;

  /**
   * Get the system prompt for the current context
   * @returns The system message or undefined
   */
  getSystemPrompt(): ChatMessage | undefined;

  /**
   * Set or update the system prompt
   * @param content - The system prompt content
   */
  setSystemPrompt(content: string): void;

  /**
   * Create a checkpoint of the current context state
   * @returns Checkpoint ID
   */
  createCheckpoint(): string;

  /**
   * Restore context to a previous checkpoint
   * @param checkpointId - The checkpoint ID to restore
   */
  restoreCheckpoint(checkpointId: string): void;

  /**
   * Remove a checkpoint
   * @param checkpointId - The checkpoint ID to remove
   */
  removeCheckpoint(checkpointId: string): void;
}
