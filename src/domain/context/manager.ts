/**
 * @fileoverview Context Manager implementation for managing conversation context
 * @module domain/context/manager
 */

import { v4 as uuidv4 } from 'uuid';

import type { ChatMessage, ToolResult, MessageRole } from '../agent/types.js';
import type { IMemoryManager } from '../memory/interface.js';
import type {
  IContextManager,
  ContextWindowConfig,
  ContextStats,
} from './types.js';
import type { ITruncationStrategy, TruncationResult } from './truncation-strategy.js';
import { createTruncationStrategy } from './truncation-strategy.js';

/**
 * Default context window configuration
 */
const DEFAULT_CONFIG: ContextWindowConfig = {
  maxMessages: 100,
  maxTokens: 8000,
  truncationStrategy: 'oldest',
};

/**
 * Checkpoint for saving context state
 */
interface ContextCheckpoint {
  id: string;
  messages: ChatMessage[];
  systemPrompt?: ChatMessage;
  timestamp: Date;
}

/**
 * Context Manager implementation with truncation strategy and memory integration
 */
export class ContextManager implements IContextManager {
  private messages: ChatMessage[] = [];
  private systemPrompt?: ChatMessage;
  private config: ContextWindowConfig;
  private truncationStrategy: ITruncationStrategy;
  private checkpoints: Map<string, ContextCheckpoint>;

  constructor(
    private readonly memoryManager?: IMemoryManager,
    config?: Partial<ContextWindowConfig>
  ) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.truncationStrategy = createTruncationStrategy(this.config.truncationStrategy);
    this.checkpoints = new Map();
  }

  /**
   * Add a message to the context
   * @param message - The message to add
   */
  addMessage(message: ChatMessage): void {
    this.messages.push(message);

    // Auto-truncate if needed
    if (this.needsTruncation()) {
      this.truncate();
    }
  }

  /**
   * Add a tool result to the context
   * Creates a tool message with the result
   * @param result - The tool result to add
   */
  addToolResult(result: ToolResult): void {
    const content = result.success
      ? result.output ?? 'Tool executed successfully'
      : `Error: ${result.error ?? 'Unknown error'}`;

    const toolMessage: ChatMessage = {
      role: 'tool' as MessageRole,
      content,
      toolCallId: result.toolCallId,
      metadata: {
        toolName: result.toolName,
        success: result.success,
        duration: result.duration,
        ...result.metadata,
      },
    };

    this.addMessage(toolMessage);
  }

  /**
   * Add a tool error to the context
   * Creates a tool message with error details
   * @param toolCallId - The tool call ID
   * @param toolName - The tool name
   * @param error - The error message or Error object
   */
  addToolError(toolCallId: string, toolName: string, error: string | Error): void {
    const errorMessage = error instanceof Error ? error.message : error;
    const errorContent = `Tool '${toolName}' failed: ${errorMessage}`;

    const toolMessage: ChatMessage = {
      role: 'tool' as MessageRole,
      content: errorContent,
      toolCallId,
      metadata: {
        toolName,
        success: false,
        error: errorMessage,
      },
    };

    this.addMessage(toolMessage);
  }

  /**
   * Get all messages in the current context
   * @returns Array of messages
   */
  getMessages(): ChatMessage[] {
    // Return messages with system prompt at the beginning if it exists
    if (this.systemPrompt) {
      // Check if system prompt is already in messages
      const hasSystem = this.messages.some(m => m.role === 'system');
      if (hasSystem) {
        return [...this.messages];
      }
      return [this.systemPrompt, ...this.messages];
    }
    return [...this.messages];
  }

  /**
   * Get the context (alias for getMessages for compatibility)
   * @returns Array of messages
   */
  getContext(): ChatMessage[] {
    return this.getMessages();
  }

  /**
   * Get messages within a specific range
   * @param start - Start index (inclusive)
   * @param end - End index (exclusive)
   * @returns Array of messages in the range
   */
  getMessageRange(start: number, end: number): ChatMessage[] {
    const allMessages = this.getMessages();
    return allMessages.slice(start, end);
  }

  /**
   * Clear all messages from context
   */
  clear(): void {
    this.messages = [];
  }

  /**
   * Get current context statistics
   * @returns Context statistics
   */
  getStats(): ContextStats {
    const allMessages = this.getMessages();
    const messageCount = allMessages.length;

    let estimatedTokens = 0;
    if (this.memoryManager) {
      const tokenCounter = this.memoryManager.getTokenCounter();
      const result = tokenCounter.countMessages(allMessages);
      estimatedTokens = result.total;
    } else {
      // Simple fallback estimation
      estimatedTokens = messageCount * 100;
    }

    const utilizationPercent = this.config.maxTokens > 0
      ? (estimatedTokens / this.config.maxTokens) * 100
      : 0;

    return {
      messageCount,
      estimatedTokens,
      utilizationPercent: Math.min(100, utilizationPercent),
    };
  }

  /**
   * Truncate context according to the configured strategy
   * @param targetSize - Target number of messages after truncation
   */
  truncate(targetSize?: number): void {
    const target = targetSize ?? this.config.maxMessages;
    const allMessages = this.getMessages();
    const systemMessage = allMessages.find(m => m.role === 'system');

    // Calculate target size (excluding system message)
    const nonSystemCount = allMessages.filter(m => m.role !== 'system').length;
    const effectiveTarget = Math.min(target, nonSystemCount);

    // Apply truncation strategy
    const result: TruncationResult = this.truncationStrategy.truncate(
      allMessages,
      effectiveTarget
    );

    // Update messages
    this.messages = result.messages.filter(m => m.role !== 'system');
    if (systemMessage) {
      this.systemPrompt = systemMessage;
    }

    // Store truncated messages in memory if available
    if (this.memoryManager && result.removedCount > 0) {
      const removedMessages = allMessages.slice(
        0,
        result.originalCount - result.messages.length
      );

      if (removedMessages.length > 0) {
        this.memoryManager.addEpisode(removedMessages, 0.3);
      }
    }
  }

  /**
   * Set the context window configuration
   * @param config - Configuration options
   */
  setConfig(config: Partial<ContextWindowConfig>): void {
    this.config = { ...this.config, ...config };

    // Update truncation strategy if changed
    if (config.truncationStrategy) {
      this.truncationStrategy = createTruncationStrategy(config.truncationStrategy);
    }
  }

  /**
   * Get the current context window configuration
   * @returns Current configuration
   */
  getConfig(): ContextWindowConfig {
    return { ...this.config };
  }

  /**
   * Check if context needs truncation
   * @returns True if context exceeds limits
   */
  needsTruncation(): boolean {
    const stats = this.getStats();
    const allMessages = this.getMessages();

    return (
      allMessages.length > this.config.maxMessages ||
      stats.estimatedTokens > this.config.maxTokens
    );
  }

  /**
   * Get the system prompt for the current context
   * @returns The system message or undefined
   */
  getSystemPrompt(): ChatMessage | undefined {
    return this.systemPrompt;
  }

  /**
   * Set or update the system prompt
   * @param content - The system prompt content
   */
  setSystemPrompt(content: string): void {
    this.systemPrompt = {
      role: 'system' as MessageRole,
      content,
    };
  }

  /**
   * Create a checkpoint of the current context state
   * @returns Checkpoint ID
   */
  createCheckpoint(): string {
    const id = uuidv4();
    const checkpoint: ContextCheckpoint = {
      id,
      messages: [...this.messages],
      systemPrompt: this.systemPrompt ? { ...this.systemPrompt } : undefined,
      timestamp: new Date(),
    };

    this.checkpoints.set(id, checkpoint);
    return id;
  }

  /**
   * Restore context to a previous checkpoint
   * @param checkpointId - The checkpoint ID to restore
   */
  restoreCheckpoint(checkpointId: string): void {
    const checkpoint = this.checkpoints.get(checkpointId);
    if (!checkpoint) {
      throw new Error(`Checkpoint not found: ${checkpointId}`);
    }

    this.messages = [...checkpoint.messages];
    this.systemPrompt = checkpoint.systemPrompt
      ? { ...checkpoint.systemPrompt }
      : undefined;
  }

  /**
   * Remove a checkpoint
   * @param checkpointId - The checkpoint ID to remove
   */
  removeCheckpoint(checkpointId: string): void {
    const deleted = this.checkpoints.delete(checkpointId);
    if (!deleted) {
      throw new Error(`Checkpoint not found: ${checkpointId}`);
    }
  }

  /**
   * Get all checkpoint IDs
   * @returns Array of checkpoint IDs
   */
  getCheckpoints(): string[] {
    return Array.from(this.checkpoints.keys());
  }

  /**
   * Clear all checkpoints
   */
  clearCheckpoints(): void {
    this.checkpoints.clear();
  }

  /**
   * Get the number of messages in context (excluding system prompt)
   * @returns Message count
   */
  getMessageCount(): number {
    return this.messages.length;
  }

  /**
   * Get the last N messages from the context
   * @param count - Number of messages to retrieve
   * @returns Array of the last N messages
   */
  getLastMessages(count: number): ChatMessage[] {
    const start = Math.max(0, this.messages.length - count);
    return this.messages.slice(start);
  }

  /**
   * Remove the last message from context
   * @returns The removed message or undefined if no messages
   */
  popMessage(): ChatMessage | undefined {
    return this.messages.pop();
  }

  /**
   * Get the memory manager instance
   * @returns The memory manager or undefined
   */
  getMemoryManager(): IMemoryManager | undefined {
    return this.memoryManager;
  }
}
