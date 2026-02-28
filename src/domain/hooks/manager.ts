/**
 * @fileoverview Hooks Manager implementation for lifecycle event management
 * @module domain/hooks/manager
 */

import type {
  IHooksManager,
  HookHandler,
  HookOptions,
  HookContext,
  HookEntry,
} from './types.js';
import { HookEvent } from './types.js';

/**
 * Internal stored hook with metadata
 */
interface StoredHook {
  id: string;
  handler: HookHandler;
  options: {
    priority: number;
    async: boolean;
    once: boolean;
    condition?: (context: HookContext) => boolean;
  };
}

/**
 * Generate unique hook ID
 */
function generateHookId(): string {
  return `hook_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
}

/**
 * Hooks Manager
 *
 * Responsibilities:
 * 1. Manage lifecycle hook registration
 * 2. Execute hooks with priority ordering
 * 3. Support async hooks
 * 4. Provide hook priority control
 * 5. Support one-time hooks
 * 6. Conditional hook execution
 *
 * @example
 * ```typescript
 * const manager = new HooksManager();
 *
 * manager.on(HookEvent.START, async (ctx) => {
 *   console.log('Agent started:', ctx.sessionId);
 * }, { priority: 10 });
 *
 * manager.once(HookEvent.ERROR, (ctx) => {
 *   console.error('Error occurred:', ctx.error);
 * });
 *
 * await manager.emit(HookEvent.START, { sessionId: '123', messages: [], data: {} });
 * ```
 */
export class HooksManager implements IHooksManager {
  private hooks: Map<HookEvent, StoredHook[]> = new Map();
  private hookCounter: number = 0;

  constructor() {
    // Initialize all hook events with empty arrays
    const events = Object.values(HookEvent);
    for (const event of events) {
      this.hooks.set(event, []);
    }
  }

  /**
   * Register a hook handler for an event
   */
  on(event: HookEvent, handler: HookHandler, options: HookOptions = {}): string {
    const hookId = generateHookId();
    const handlers = this.hooks.get(event) || [];

    const storedHook: StoredHook = {
      id: hookId,
      handler,
      options: {
        priority: options.priority ?? 0,
        async: options.async ?? true,
        once: options.once ?? false,
        condition: options.condition,
      },
    };

    handlers.push(storedHook);

    // Sort by priority (higher priority first)
    handlers.sort((a, b) => b.options.priority - a.options.priority);

    this.hooks.set(event, handlers);
    this.hookCounter++;

    return hookId;
  }

  /**
   * Register a one-time hook handler
   */
  once(event: HookEvent, handler: HookHandler, options: HookOptions = {}): string {
    return this.on(event, handler, { ...options, once: true });
  }

  /**
   * Remove a hook handler by ID
   */
  off(hookId: string): boolean {
    for (const [event, handlers] of this.hooks.entries()) {
      const index = handlers.findIndex(h => h.id === hookId);
      if (index >= 0) {
        handlers.splice(index, 1);
        this.hookCounter--;
        return true;
      }
    }
    return false;
  }

  /**
   * Remove all handlers for an event
   */
  offAll(event: HookEvent): void {
    const handlers = this.hooks.get(event);
    if (handlers) {
      this.hookCounter -= handlers.length;
      this.hooks.set(event, []);
    }
  }

  /**
   * Trigger all handlers for an event
   */
  async emit(
    event: HookEvent,
    context: Omit<HookContext, 'event' | 'timestamp'>
  ): Promise<void> {
    const handlers = this.hooks.get(event) || [];
    const toRemove: string[] = [];

    // Create full hook context
    const fullContext: HookContext = {
      event,
      timestamp: new Date(),
      ...context,
    };

    // Execute hooks in priority order
    for (const hook of handlers) {
      // Check condition if provided
      if (hook.options.condition && !hook.options.condition(fullContext)) {
        continue;
      }

      try {
        // step1. 始终等待钩子处理完成，避免竞态条件
        // step2. 即使是同步钩子，也使用 Promise.resolve 包装以确保执行顺序
        await Promise.resolve(hook.handler(fullContext));
      } catch (error) {
        // Hook execution errors should not break other hooks
        // 记录详细的错误信息（包括钩子 ID、事件类型和错误堆栈）
        const errorMessage = error instanceof Error ? error.message : String(error);
        const errorStack = error instanceof Error ? error.stack : undefined;
        console.error(
          `[HooksManager] Hook error in ${event} (hook: ${hook.id}): ${errorMessage}`,
          errorStack ? `\nStack: ${errorStack}` : ''
        );
      }

      // Mark one-time hooks for removal
      if (hook.options.once) {
        toRemove.push(hook.id);
      }
    }

    // Remove one-time hooks
    if (toRemove.length > 0) {
      const handlers = this.hooks.get(event) || [];
      const filteredHandlers = handlers.filter(h => !toRemove.includes(h.id));
      this.hooks.set(event, filteredHandlers);
      this.hookCounter -= toRemove.length;
    }
  }

  /**
   * Get all registered hooks
   */
  getHooks(): HookEntry[] {
    const entries: HookEntry[] = [];

    for (const [event, handlers] of this.hooks.entries()) {
      for (const hook of handlers) {
        entries.push({
          id: hook.id,
          event,
          handler: hook.handler,
          options: {
            priority: hook.options.priority,
            async: hook.options.async,
            once: hook.options.once,
            condition: hook.options.condition ?? (() => true),
          },
        } as HookEntry);
      }
    }

    return entries;
  }

  /**
   * Get hooks for a specific event
   */
  getHooksForEvent(event: HookEvent): HookEntry[] {
    const handlers = this.hooks.get(event) || [];

    return handlers.map(hook => ({
      id: hook.id,
      event,
      handler: hook.handler,
      options: {
        priority: hook.options.priority,
        async: hook.options.async,
        once: hook.options.once,
        condition: hook.options.condition ?? (() => true),
      },
    } as HookEntry));
  }

  /**
   * Check if any hooks are registered for an event
   */
  hasHooks(event: HookEvent): boolean {
    const handlers = this.hooks.get(event);
    return handlers ? handlers.length > 0 : false;
  }

  /**
   * Remove all hooks
   */
  clear(): void {
    const events = Object.values(HookEvent);
    for (const event of events) {
      this.hooks.set(event, []);
    }
    this.hookCounter = 0;
  }

  /**
   * Add a middleware hook with high priority
   * Middleware hooks run before regular hooks
   */
  use(event: HookEvent, handler: HookHandler): string {
    return this.on(event, handler, { priority: 1000 });
  }

  /**
   * Get total number of registered hooks
   */
  getHookCount(): number {
    return this.hookCounter;
  }
}
