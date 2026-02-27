/**
 * @fileoverview Domain types for Agent core functionality
 * @module domain/agent/types
 */

/**
 * Message role types in the conversation
 */
export enum MessageRole {
  /** System message defining agent behavior */
  SYSTEM = 'system',
  /** User input message */
  USER = 'user',
  /** Assistant response message */
  ASSISTANT = 'assistant',
  /** Tool execution result message */
  TOOL = 'tool',
}

/**
 * Represents a single message in the conversation
 */
export interface ChatMessage {
  /** The role of the message sender */
  role: MessageRole;
  /** Content of the message */
  content: string;
  /** Optional tool calls made by the assistant */
  toolCalls?: ToolCall[];
  /** Optional tool call ID for tool result messages */
  toolCallId?: string;
  /** Optional metadata for the message */
  metadata?: Record<string, unknown>;
}

/**
 * Represents a tool call invocation
 */
export interface ToolCall {
  /** Unique identifier for this tool call */
  id: string;
  /** Name of the tool being called */
  name: string;
  /** Arguments passed to the tool (JSON stringified) */
  arguments: string;
  /** Optional parsed arguments object */
  args?: Record<string, unknown>;
}

/**
 * Represents the result of a tool execution
 */
export interface ToolResult {
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
  /** Optional execution duration in milliseconds */
  duration?: number;
  /** Optional metadata */
  metadata?: Record<string, unknown>;
}

/**
 * Token usage statistics for an AI response
 */
export interface TokenUsage {
  /** Number of tokens in the input prompt */
  promptTokens: number;
  /** Number of tokens in the completion */
  completionTokens: number;
  /** Total tokens used */
  totalTokens: number;
}

/**
 * Agent configuration options
 */
export interface AgentConfig {
  /** Model identifier (e.g., 'glm-4.7', 'gpt-4') */
  model: string;
  /** Base URL for the API (for compatible endpoints) */
  baseURL?: string;
  /** API key for authentication */
  apiKey: string;
  /** Temperature setting for response randomness (0-2) */
  temperature?: number;
  /** Maximum tokens in the response */
  maxTokens?: number;
  /** Top-p sampling parameter */
  topP?: number;
  /** Whether to enable streaming responses */
  stream?: boolean;
  /** Optional custom headers for API requests */
  headers?: Record<string, string>;
}

/**
 * Security rule for tool execution
 */
export interface SecurityRule {
  /** Unique identifier for the rule */
  id: string;
  /** Rule name/description */
  name: string;
  /** Regex pattern to match against tool calls */
  pattern: RegExp;
  /** Severity level of the rule */
  severity: 'low' | 'medium' | 'high' | 'critical';
  /** Action to take when rule is triggered */
  action: 'warn' | 'block' | 'require-confirmation';
  /** Custom error/warning message */
  message?: string;
  /** Whether the rule is enabled */
  enabled: boolean;
}

/**
 * Runtime context for the agent
 */
export interface AgentContext {
  /** Unique identifier for the current session */
  sessionId: string;
  /** Current conversation messages */
  messages: ChatMessage[];
  /** Available tools for the agent */
  tools: string[];
  /** Current active skill (if any) */
  activeSkill?: string;
  /** Token usage statistics for the session */
  tokenUsage: TokenUsage;
  /** Security rules applied to this session */
  securityRules: SecurityRule[];
  /** Optional user preferences */
  preferences?: Record<string, unknown>;
  /** Optional session metadata */
  metadata?: Record<string, unknown>;
}
