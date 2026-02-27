/**
 * @fileoverview Data Transfer Objects for chat operations
 * @module application/dto/chat.dto
 */

/**
 * DTO for sending a message to the AI agent
 */
export interface SendMessageDto {
  /** The user's message content */
  message: string;
  /** Optional session ID to continue an existing conversation */
  sessionId?: string;
  /** Optional model override for this request */
  model?: string;
  /** Optional temperature override for this request */
  temperature?: number;
  /** Optional max tokens override for this request */
  maxTokens?: number;
  /** Optional streaming flag for this request */
  stream?: boolean;
}

/**
 * Tool call information in the response
 */
export interface ResponseToolCall {
  /** Unique identifier for the tool call */
  id: string;
  /** Name of the tool that was called */
  name: string;
  /** Arguments passed to the tool */
  arguments: string;
  /** Optional parsed arguments */
  args?: Record<string, unknown>;
}

/**
 * Tool result information in the response
 */
export interface ResponseToolResult {
  /** The tool call ID this result corresponds to */
  toolCallId: string;
  /** Name of the tool that was executed */
  toolName: string;
  /** Whether the tool execution was successful */
  success: boolean;
  /** The result output from the tool */
  output?: string;
  /** Error details if execution failed */
  error?: string;
  /** Execution duration in milliseconds */
  duration?: number;
}

/**
 * Token usage information in the response
 */
export interface ResponseTokenUsage {
  /** Number of tokens in the input prompt */
  promptTokens: number;
  /** Number of tokens in the completion */
  completionTokens: number;
  /** Total tokens used */
  totalTokens: number;
}

/**
 * DTO for the response from sending a message
 */
export interface SendMessageResponseDto {
  /** The agent's response text */
  response: string;
  /** Session ID for this conversation */
  sessionId: string;
  /** Number of thought iterations performed */
  iterations: number;
  /** Tool calls made during processing */
  toolCalls: ResponseToolCall[];
  /** Tool results from executed tools */
  toolResults: ResponseToolResult[];
  /** Token usage statistics */
  tokenUsage: ResponseTokenUsage;
  /** Whether the processing completed successfully */
  success: boolean;
  /** Error message if processing failed */
  error?: string;
  /** Timestamp of the response */
  timestamp: string;
}

/**
 * Service status enum
 */
export enum ServiceStatus {
  /** Service is initializing */
  INITIALIZING = 'initializing',
  /** Service is ready and idle */
  IDLE = 'idle',
  /** Service is processing a request */
  PROCESSING = 'processing',
  /** Service has encountered an error */
  ERROR = 'error',
  /** Service is shutting down */
  SHUTTING_DOWN = 'shutting_down',
  /** Service is stopped */
  STOPPED = 'stopped',
}

/**
 * Service status information
 */
export interface ServiceStatusInfo {
  /** Current status of the service */
  status: ServiceStatus;
  /** Session ID if a session is active */
  sessionId?: string;
  /** Current model being used */
  model?: string;
  /** Number of messages in the current session */
  messageCount?: number;
  /** Total tokens used in the current session */
  totalTokens?: number;
  /** Whether streaming is enabled */
  streamingEnabled?: boolean;
  /** Error message if status is error */
  error?: string;
  /** Last activity timestamp */
  lastActivity?: string;
}

/**
 * DTO for clearing conversation history
 */
export interface ClearHistoryDto {
  /** Optional session ID to clear (defaults to current session) */
  sessionId?: string;
  /** Whether to clear system prompt as well */
  clearSystemPrompt?: boolean;
}

/**
 * DTO for history clear response
 */
export interface ClearHistoryResponseDto {
  /** Whether the operation was successful */
  success: boolean;
  /** Session ID that was cleared */
  sessionId: string;
  /** Number of messages cleared */
  messagesCleared: number;
  /** Timestamp of the operation */
  timestamp: string;
}
