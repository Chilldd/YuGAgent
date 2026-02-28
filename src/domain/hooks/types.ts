/**
 * @fileoverview Domain types for Hooks lifecycle management
 * @module domain/hooks/types
 */

import type { ChatMessage, ToolCall, ToolResult } from '../agent/types.js';

/**
 * Hook event types representing lifecycle events
 */
export enum HookEvent {
  /** Agent starts processing a new request */
  START = 'start',
  /** Agent is thinking/generating response */
  THINKING = 'thinking',
  /** Before a tool is called */
  BEFORE_TOOL = 'beforeTool',
  /** After a tool completes execution */
  AFTER_TOOL = 'afterTool',
  /** When a tool call fails */
  TOOL_ERROR = 'toolError',
  /** Agent completes a response */
  COMPLETE = 'complete',
  /** When an error occurs in the agent */
  ERROR = 'error',
  /** Before sending message to AI model */
  BEFORE_SEND = 'beforeSend',
  /** After receiving response from AI model */
  AFTER_RECEIVE = 'afterReceive',
  /** Security check events */
  SECURITY_CHECK = 'securityCheck',
  /** Memory operations */
  MEMORY_READ = 'memoryRead',
  MEMORY_WRITE = 'memoryWrite',
  /** Context updates */
  CONTEXT_UPDATE = 'contextUpdate',
  /** 流式内容块事件 */
  CONTENT_CHUNK = 'contentChunk',
  /** 中间消息更新事件（工具执行完成后立即更新 UI） */
  MESSAGES_UPDATE = 'messagesUpdate',
}

/**
 * Hook context providing information about the current event
 */
export interface HookContext {
  /** The type of hook event */
  event: HookEvent;
  /** Current session ID */
  sessionId: string;
  /** Timestamp when the hook was triggered */
  timestamp: Date;
  /** Current messages in context */
  messages: ChatMessage[];
  /** The current tool call (for tool-related events) */
  toolCall?: ToolCall;
  /** The current tool result (for tool result events) */
  toolResult?: ToolResult;
  /** Error details (for error events) */
  error?: Error;
  /** Additional event-specific data */
  data: Record<string, unknown>;
}

/**
 * Hook handler function type
 */
export type HookHandler = (context: HookContext) => void | Promise<void>;

/**
 * Hook options for registration
 */
export interface HookOptions {
  /** Priority for execution order (higher = earlier) */
  priority?: number;
  /** Whether the hook should run asynchronously */
  async?: boolean;
  /** Whether the hook is a one-time handler */
  once?: boolean;
  /** Optional condition function to determine if hook should run */
  condition?: (context: HookContext) => boolean;
}

/**
 * Registered hook entry
 */
export interface HookEntry {
  /** Unique identifier for the hook */
  id: string;
  /** The event this hook listens to */
  event: HookEvent;
  /** The handler function */
  handler: HookHandler;
  /** Hook options */
  options: Required<Omit<HookOptions, 'once'>> & { once: boolean };
}

/**
 * Hooks manager interface for lifecycle event management
 */
export interface IHooksManager {
  /**
   * Register a hook handler for an event
   * @param event - The event to listen for
   * @param handler - The handler function
   * @param options - Optional hook configuration
   * @returns Hook ID for later removal
   */
  on(event: HookEvent, handler: HookHandler, options?: HookOptions): string;

  /**
   * Register a one-time hook handler
   * @param event - The event to listen for
   * @param handler - The handler function
   * @param options - Optional hook configuration
   * @returns Hook ID for later removal
   */
  once(event: HookEvent, handler: HookHandler, options?: HookOptions): string;

  /**
   * Remove a hook handler
   * @param hookId - The hook ID to remove
   * @returns True if removed, false if not found
   */
  off(hookId: string): boolean;

  /**
   * Remove all handlers for an event
   * @param event - The event to clear handlers for
   */
  offAll(event: HookEvent): void;

  /**
   * Trigger all handlers for an event
   * @param event - The event to trigger
   * @param context - The hook context to pass to handlers
   * @returns Promise that resolves when all handlers complete
   */
  emit(event: HookEvent, context: Omit<HookContext, 'event' | 'timestamp'>): Promise<void>;

  /**
   * Get all registered hooks
   * @returns Array of registered hook entries
   */
  getHooks(): HookEntry[];

  /**
   * Get hooks for a specific event
   * @param event - The event to get hooks for
   * @returns Array of hook entries for the event
   */
  getHooksForEvent(event: HookEvent): HookEntry[];

  /**
   * Check if any hooks are registered for an event
   * @param event - The event to check
   * @returns True if hooks exist for the event
   */
  hasHooks(event: HookEvent): boolean;

  /**
   * Remove all hooks
   */
  clear(): void;

  /**
   * Add a middleware hook that runs before all other hooks
   * @param event - The event to add middleware for
   * @param handler - The middleware handler
   * @returns Hook ID for later removal
   */
  use(event: HookEvent, handler: HookHandler): string;
}
