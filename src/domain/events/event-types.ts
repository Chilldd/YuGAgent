/**
 * @fileoverview Domain types for System Events
 * @module domain/events/event-types
 */

import type { ChatMessage, ToolCall, ToolResult, TokenUsage } from '../agent/types.js';

/**
 * System event types for internal event bus
 */
export enum SystemEventType {
  // ============== Agent Lifecycle Events ==============
  /** Agent session started */
  SESSION_START = 'session:start',
  /** Agent session ended */
  SESSION_END = 'session:end',
  /** Agent is processing a request */
  AGENT_THINKING = 'agent:thinking',
  /** Agent completed a request */
  AGENT_COMPLETE = 'agent:complete',
  /** Agent encountered an error */
  AGENT_ERROR = 'agent:error',

  // ============== Message Events ==============
  /** New message received from user */
  MESSAGE_RECEIVED = 'message:received',
  /** Message added to context */
  MESSAGE_ADDED = 'message:added',
  /** Message modified */
  MESSAGE_UPDATED = 'message:updated',
  /** Message removed from context */
  MESSAGE_REMOVED = 'message:removed',

  // ============== Tool Events ==============
  /** Tool execution started */
  TOOL_START = 'tool:start',
  /** Tool execution completed successfully */
  TOOL_SUCCESS = 'tool:success',
  /** Tool execution failed */
  TOOL_ERROR = 'tool:error',
  /** Tool call was blocked (e.g., by security rules) */
  TOOL_BLOCKED = 'tool:blocked',
  /** Tool call requires user confirmation */
  TOOL_PENDING_CONFIRMATION = 'tool:pending:confirmation',

  // ============== Model Events ==============
  /** Request sent to AI model */
  MODEL_REQUEST = 'model:request',
  /** Response received from AI model */
  MODEL_RESPONSE = 'model:response',
  /** Model streaming chunk received */
  MODEL_STREAM_CHUNK = 'model:stream:chunk',
  /** Model request failed */
  MODEL_ERROR = 'model:error',

  // ============== Context Events ==============
  /** Context was truncated */
  CONTEXT_TRUNCATED = 'context:truncated',
  /** Context checkpoint created */
  CONTEXT_CHECKPOINT_CREATED = 'context:checkpoint:created',
  /** Context checkpoint restored */
  CONTEXT_CHECKPOINT_RESTORED = 'context:checkpoint:restored',
  /** Context limit reached */
  CONTEXT_LIMIT_REACHED = 'context:limit:reached',

  // ============== Memory Events ==============
  /** Memory entry stored */
  MEMORY_STORED = 'memory:stored',
  /** Memory entry retrieved */
  MEMORY_RETRIEVED = 'memory:retrieved',
  /** Memory entry updated */
  MEMORY_UPDATED = 'memory:updated',
  /** Memory entry deleted */
  MEMORY_DELETED = 'memory:deleted',
  /** Memory was pruned */
  MEMORY_PRUNED = 'memory:pruned',

  // ============== Security Events ==============
  /** Security rule triggered */
  SECURITY_TRIGGERED = 'security:triggered',
  /** Security violation detected */
  SECURITY_VIOLATION = 'security:violation',
  /** Security check passed */
  SECURITY_PASSED = 'security:passed',

  // ============== UI Events ==============
  /** UI should show loading state */
  UI_LOADING_START = 'ui:loading:start',
  /** UI should hide loading state */
  UI_LOADING_END = 'ui:loading:end',
  /** UI should show progress */
  UI_PROGRESS = 'ui:progress',
  /** UI should show notification */
  UI_NOTIFICATION = 'ui:notification',

  // ============== Skill Events ==============
  /** Skill activated */
  SKILL_ACTIVATED = 'skill:activated',
  /** Skill deactivated */
  SKILL_DEACTIVATED = 'skill:deactivated',
  /** Skill switched */
  SKILL_SWITCHED = 'skill:switched',

  // ============== Configuration Events ==============
  /** Configuration changed */
  CONFIG_CHANGED = 'config:changed',
  /** Configuration reloaded */
  CONFIG_RELOADED = 'config:reloaded',
}

/**
 * Base event data structure
 */
export interface BaseEventData {
  /** Event type identifier */
  type: SystemEventType;
  /** Timestamp when the event occurred */
  timestamp: Date;
  /** Unique event ID */
  eventId: string;
  /** Associated session ID */
  sessionId?: string;
}

/**
 * Session start event data
 */
export interface SessionStartEventData extends BaseEventData {
  type: SystemEventType.SESSION_START;
  /** Session ID */
  sessionId: string;
  /** Initial configuration */
  config?: Record<string, unknown>;
}

/**
 * Session end event data
 */
export interface SessionEndEventData extends BaseEventData {
  type: SystemEventType.SESSION_END;
  /** Session ID */
  sessionId: string;
  /** Reason for ending */
  reason?: 'user-exit' | 'error' | 'timeout' | 'completed';
  /** Session duration in milliseconds */
  duration: number;
}

/**
 * Tool event data
 */
export interface ToolEventData extends BaseEventData {
  type: SystemEventType.TOOL_START | SystemEventType.TOOL_SUCCESS | SystemEventType.TOOL_ERROR | SystemEventType.TOOL_BLOCKED;
  /** Tool call details */
  toolCall: ToolCall;
  /** Tool result (for success/error events) */
  result?: ToolResult;
  /** Error details (for error events) */
  error?: Error;
  /** Security rule that blocked the tool (for blocked events) */
  securityRule?: string;
}

/**
 * Model event data
 */
export interface ModelEventData extends BaseEventData {
  type: SystemEventType.MODEL_REQUEST | SystemEventType.MODEL_RESPONSE | SystemEventType.MODEL_ERROR;
  /** Messages sent to the model */
  messages: ChatMessage[];
  /** Model name/ID */
  model: string;
  /** Token usage information */
  tokenUsage?: TokenUsage;
  /** Error details (for error events) */
  error?: Error;
}

/**
 * Model stream chunk event data
 */
export interface ModelStreamChunkEventData extends BaseEventData {
  type: SystemEventType.MODEL_STREAM_CHUNK;
  /** Stream chunk content */
  content: string;
  /** Whether this is the final chunk */
  isComplete: boolean;
}

/**
 * Context event data
 */
export interface ContextEventData extends BaseEventData {
  type: SystemEventType.CONTEXT_TRUNCATED | SystemEventType.CONTEXT_LIMIT_REACHED;
  /** Number of messages before event */
  beforeCount: number;
  /** Number of messages after event */
  afterCount: number;
  /** Truncation strategy used */
  strategy?: string;
}

/**
 * Memory event data
 */
export interface MemoryEventData extends BaseEventData {
  type: SystemEventType.MEMORY_STORED | SystemEventType.MEMORY_RETRIEVED | SystemEventType.MEMORY_UPDATED | SystemEventType.MEMORY_DELETED;
  /** Memory ID */
  memoryId: string;
  /** Memory content (truncated for events) */
  content?: string;
  /** Memory type */
  memoryType?: string;
}

/**
 * Security event data
 */
export interface SecurityEventData extends BaseEventData {
  type: SystemEventType.SECURITY_TRIGGERED | SystemEventType.SECURITY_VIOLATION | SystemEventType.SECURITY_PASSED;
  /** Security rule ID that was triggered */
  ruleId: string;
  /** Tool call that triggered the rule */
  toolCall?: ToolCall;
  /** Action taken */
  action: 'warn' | 'block' | 'allow';
  /** Severity level */
  severity: 'low' | 'medium' | 'high' | 'critical';
  /** Message shown to user */
  message?: string;
}

/**
 * Union type for all event data
 */
export type EventData =
  | SessionStartEventData
  | SessionEndEventData
  | ToolEventData
  | ModelEventData
  | ModelStreamChunkEventData
  | ContextEventData
  | MemoryEventData
  | SecurityEventData;

/**
 * Event listener function type
 */
export type EventListener<T extends EventData = EventData> = (data: T) => void | Promise<void>;

/**
 * Event listener options
 */
export interface EventListenerOptions {
  /** Whether to listen only once */
  once?: boolean;
  /** Priority for execution order (higher = earlier) */
  priority?: number;
  /** Optional condition function */
  condition?: (data: EventData) => boolean;
}
