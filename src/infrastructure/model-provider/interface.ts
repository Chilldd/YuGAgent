/**
 * @fileoverview Model Provider interface for AI model abstraction
 * @module infrastructure/model-provider/interface
 */

import type { ChatMessage, TokenUsage } from '../../domain/agent/types.js';

/**
 * Model completion request parameters
 */
export interface ModelCompleteRequest {
  /** Messages to send to the model */
  messages: ChatMessage[];
  /** Model identifier (e.g., 'glm-4.7', 'gpt-4') */
  model: string;
  /** Temperature setting for response randomness (0-2) */
  temperature?: number;
  /** Maximum tokens in the response */
  maxTokens?: number;
  /** Top-p sampling parameter */
  topP?: number;
  /** Optional stop sequences */
  stopSequences?: string[];
  /** Whether to enable streaming responses */
  stream?: boolean;
  /** Optional custom headers for API requests */
  headers?: Record<string, string>;
  /** Optional tools/functions for the model to use */
  tools?: ToolDefinition[];
  /** Optional tool choice setting */
  toolChoice?: 'auto' | 'required' | 'none';
}

/**
 * Tool/function definition for model
 */
export interface ToolDefinition {
  /** Unique identifier for the tool */
  id: string;
  /** Tool name */
  name: string;
  /** Tool description */
  description: string;
  /** JSON Schema for tool parameters */
  parameters?: Record<string, unknown>;
}

/**
 * Model completion response
 */
export interface ModelCompleteResponse {
  /** Generated text content */
  text: string;
  /** Token usage statistics */
  usage: TokenUsage;
  /** Tool calls made by the model */
  toolCalls?: ToolCall[];
  /** Finish reason */
  finishReason: 'stop' | 'length' | 'tool_calls' | 'content_filter' | 'error';
  /** Model used for generation */
  model: string;
  /** Unique identifier for the response */
  id?: string;
}

/**
 * Tool call from model response
 */
export interface ToolCall {
  /** Unique identifier for this tool call */
  id: string;
  /** Name of the tool being called */
  name: string;
  /** Arguments passed to the tool (JSON stringified) */
  arguments: string;
}

/**
 * Stream chunk for streaming responses
 */
export interface StreamChunk {
  /** Text content for this chunk */
  text: string;
  /** Whether this is the final chunk */
  isComplete: boolean;
  /** Optional tool calls (only in final chunk or when tool calls are detected) */
  toolCalls?: ToolCall[];
  /** Optional token usage (only in final chunk) */
  usage?: TokenUsage;
  /** Optional finish reason (only in final chunk) */
  finishReason?: ModelCompleteResponse['finishReason'];
}

/**
 * Health check result
 */
export interface HealthCheckResult {
  /** Whether the provider is healthy */
  healthy: boolean;
  /** Status message */
  message: string;
  /** Optional latency in milliseconds */
  latency?: number;
  /** Optional error details */
  error?: string;
}

/**
 * Model provider configuration
 */
export interface ModelProviderConfig {
  /** API key for authentication */
  apiKey: string;
  /** Base URL for the API (for compatible endpoints) */
  baseURL?: string;
  /** Default model to use */
  model?: string;
  /** Optional custom headers */
  headers?: Record<string, string>;
  /** Request timeout in milliseconds */
  timeout?: number;
  /** Maximum retries for failed requests */
  maxRetries?: number;
}

/**
 * Model provider interface for AI model abstraction
 * Implementations should support different model providers (Zhipu, OpenAI, etc.)
 */
export interface IModelProvider {
  /**
   * Get the provider identifier
   */
  readonly providerId: string;

  /**
   * Get the current configuration
   */
  getConfig(): ModelProviderConfig;

  /**
   * Complete a model request (non-streaming)
   * @param request - Model completion request
   * @returns Promise resolving to model completion response
   */
  complete(request: ModelCompleteRequest): Promise<ModelCompleteResponse>;

  /**
   * Stream a model request (streaming)
   * @param request - Model completion request with stream enabled
   * @returns Async generator yielding stream chunks
   */
  stream(request: ModelCompleteRequest): AsyncGenerator<StreamChunk>;

  /**
   * Count tokens in a text string
   * @param text - Text to count tokens for
   * @returns Estimated token count
   */
  countTokens(text: string): number;

  /**
   * Count tokens in an array of messages
   * @param messages - Messages to count tokens for
   * @returns Estimated token count
   */
  countMessagesTokens(messages: ChatMessage[]): number;

  /**
   * Perform a health check on the provider
   * @returns Promise resolving to health check result
   */
  healthCheck(): Promise<HealthCheckResult>;

  /**
   * Validate the provider configuration
   * @returns True if configuration is valid
   */
  validateConfig(): boolean;
}

/**
 * Token counting capability for model providers
 */
export interface ITokenCounter {
  /**
   * Count tokens in a text string
   * @param text - Text to count tokens for
   * @returns Estimated token count
   */
  countTokens(text: string): number;

  /**
   * Count tokens in an array of messages
   * @param messages - Messages to count tokens for
   * @returns Estimated token count
   */
  countMessagesTokens(messages: ChatMessage[]): number;
}
