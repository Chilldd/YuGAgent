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
 * Maximum number of checkpoints to prevent memory leaks
 */
const MAX_CHECKPOINTS = 50;

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
    // step1. 验证配置参数的合理性，防止极端值导致问题
    // step2. 先合并默认配置，然后再验证和限制极端值
    this.config = { ...DEFAULT_CONFIG, ...config };

    // 限制 maxMessages 在合理范围内 [0, 100000]
    if (this.config.maxMessages !== undefined) {
      this.config.maxMessages = Math.max(0, Math.min(this.config.maxMessages, 100000));
    }
    // 限制 maxTokens 在合理范围内 [0, 10000000]
    if (this.config.maxTokens !== undefined) {
      this.config.maxTokens = Math.max(0, Math.min(this.config.maxTokens, 10000000));
    }

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

    // 简单的 token 估算：每个字符约 0.25 个 token，每条消息平均 100 个 token
    let estimatedTokens = messageCount * 100;

    // 如果有 memoryManager，可以使用它来获取更精确的计数
    // 但由于接口限制，这里使用简单的估算方法
    const totalChars = allMessages.reduce((sum, msg) => sum + msg.content.length, 0);
    estimatedTokens = Math.max(estimatedTokens, Math.ceil(totalChars / 4));

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

    // Update messages - 分离 system 消息和其他消息
    const resultSystemMessage = result.messages.find(m => m.role === 'system');
    this.messages = result.messages.filter(m => m.role !== 'system');
    if (resultSystemMessage) {
      this.systemPrompt = resultSystemMessage;
    } else if (systemMessage) {
      // 如果截断结果中没有 system 消息，保留原有的
      this.systemPrompt = systemMessage;
    }

    // Store truncated messages in memory if available
    if (this.memoryManager && result.removedCount > 0) {
      // 计算实际被移除的消息（排除 system 消息）
      const nonSystemMessages = allMessages.filter(m => m.role !== 'system');
      const keptMessages = result.messages.filter(m => m.role !== 'system');
      const removedCount = nonSystemMessages.length - keptMessages.length;

      if (removedCount > 0) {
        // 获取被移除的消息（最旧的消息）
        const removedMessages = nonSystemMessages.slice(0, removedCount);
        this.memoryManager.addEpisode(removedMessages, 0.3);
      }
    }
  }

  /**
   * Set the context window configuration
   * @param config - Configuration options
   */
  setConfig(config: Partial<ContextWindowConfig>): void {
    // step1. 验证输入参数
    if (!config || typeof config !== 'object') {
      throw new Error('Config must be a valid object');
    }

    // step2. 验证并限制 maxMessages
    if (config.maxMessages !== undefined) {
      if (typeof config.maxMessages !== 'number' || config.maxMessages < 0) {
        throw new Error('maxMessages must be a non-negative number');
      }
      // 限制在合理范围内
      config.maxMessages = Math.min(config.maxMessages, 100000);
    }

    // step3. 验证并限制 maxTokens
    if (config.maxTokens !== undefined) {
      if (typeof config.maxTokens !== 'number' || config.maxTokens < 0) {
        throw new Error('maxTokens must be a non-negative number');
      }
      // 限制在合理范围内
      config.maxTokens = Math.min(config.maxTokens, 10000000);
    }

    // step4. 验证 truncationStrategy
    if (config.truncationStrategy !== undefined) {
      const validStrategies = ['oldest', 'least-recent', 'smart'];
      if (!validStrategies.includes(config.truncationStrategy)) {
        throw new Error(`Invalid truncation strategy: ${config.truncationStrategy}`);
      }
    }

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

    // step1. 防止 checkpoint 无限增长导致内存泄漏
    // step2. 超过限制时，删除最旧的 checkpoint
    if (this.checkpoints.size > MAX_CHECKPOINTS) {
      const oldestId = Array.from(this.checkpoints.entries())
        .sort(([, a], [, b]) => a.timestamp.getTime() - b.timestamp.getTime())[0][0];
      this.checkpoints.delete(oldestId);
    }

    return id;
  }

  /**
   * Restore context to a previous checkpoint
   * @param checkpointId - The checkpoint ID to restore
   */
  restoreCheckpoint(checkpointId: string): void {
    // step1. 验证 checkpointId 参数
    if (!checkpointId || typeof checkpointId !== 'string') {
      throw new Error('Checkpoint ID must be a non-empty string');
    }

    const checkpoint = this.checkpoints.get(checkpointId);
    if (!checkpoint) {
      // 记录未找到的 checkpoint ID（便于调试）
      console.warn(`[ContextManager] Checkpoint not found: ${checkpointId}`);
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
