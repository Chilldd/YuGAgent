/**
 * @fileoverview Middleware chain implementation with onion model
 * @module domain/hooks/middleware-chain
 */

/**
 * Middleware function type
 *
 * A middleware function receives the context and a next function.
 * It can modify the context before calling next(), and perform actions
 * after next() returns (onion model).
 *
 * @template T - The context type
 * @param context - The context object to pass through the chain
 * @param next - Function to call the next middleware
 * @returns Promise that resolves when middleware completes
 *
 * @example
 * ```typescript
 * const loggingMiddleware: MiddlewareFunction<MyContext> = async (ctx, next) => {
 *   console.log('Before:', ctx);
 *   await next();
 *   console.log('After:', ctx);
 * };
 * ```
 */
export type MiddlewareFunction<T = unknown> = (
  context: T,
  next: () => Promise<void>
) => Promise<void> | void;

/**
 * Middleware chain options
 */
export interface MiddlewareChainOptions {
  /** Enable error recovery in middleware chain */
  recoverErrors?: boolean;
  /** Error handler for middleware errors */
  errorHandler?: (error: Error, context: unknown) => void;
}

/**
 * Middleware Chain
 *
 * Implements the onion model (also known as the Russian doll model)
 * for middleware execution. Each middleware wraps the next one,
 * allowing pre-processing and post-processing.
 *
 * Execution flow:
 * Middleware1 (before) -> Middleware2 (before) -> ... -> Core -> ... -> Middleware2 (after) -> Middleware1 (after)
 *
 * @template T - The context type
 *
 * @example
 * ```typescript
 * const chain = new MiddlewareChain<{ value: number }>();
 *
 * chain.use(async (ctx, next) => {
 *   console.log('Middleware 1 before:', ctx.value);
 *   await next();
 *   console.log('Middleware 1 after:', ctx.value);
 * });
 *
 * chain.use(async (ctx, next) => {
 *   ctx.value *= 2;
 *   await next();
 * });
 *
 * await chain.execute({ value: 5 });
 * // Output: Middleware 1 before: 5
 * //         Middleware 1 after: 10
 * ```
 */
export class MiddlewareChain<T = unknown> {
  private middlewares: MiddlewareFunction<T>[] = [];
  private options: MiddlewareChainOptions;

  constructor(options?: MiddlewareChainOptions) {
    this.options = {
      recoverErrors: options?.recoverErrors ?? false,
      errorHandler: options?.errorHandler,
    };
  }

  /**
   * Add a middleware to the chain
   * @param middleware - The middleware function to add
   * @returns The chain instance for chaining
   */
  use(middleware: MiddlewareFunction<T>): this {
    this.middlewares.push(middleware);
    return this;
  }

  /**
   * Execute the middleware chain
   * @param context - The context object to pass through the chain
   * @returns Promise that resolves when all middleware completes
   */
  async execute(context: T): Promise<void> {
    let index = 0;

    const next = async (): Promise<void> => {
      // Check if we've reached the end of the chain
      if (index >= this.middlewares.length) {
        return;
      }

      // Get current middleware and advance index
      const middleware = this.middlewares[index++];

      try {
        // Execute the middleware
        await middleware(context, next);
      } catch (error) {
        // Handle error based on options
        if (this.options.errorHandler) {
          this.options.errorHandler(error as Error, context);
        }

        // If not recovering, re-throw the error
        if (!this.options.recoverErrors) {
          throw error;
        }
      }
    };

    // Start the chain
    await next();
  }

  /**
   * Clear all middleware from the chain
   */
  clear(): void {
    this.middlewares = [];
  }

  /**
   * Remove middleware by index
   * @param index - The index of the middleware to remove
   * @returns True if removed, false if index is invalid
   */
  remove(index: number): boolean {
    if (index >= 0 && index < this.middlewares.length) {
      this.middlewares.splice(index, 1);
      return true;
    }
    return false;
  }

  /**
   * Get the number of middleware in the chain
   */
  get length(): number {
    return this.middlewares.length;
  }

  /**
   * Check if the chain is empty
   */
  isEmpty(): boolean {
    return this.middlewares.length === 0;
  }

  /**
   * Create a snapshot of the current middleware chain
   * @returns Array of middleware functions
   */
  snapshot(): MiddlewareFunction<T>[] {
    return [...this.middlewares];
  }

  /**
   * Restore middleware chain from a snapshot
   * @param middlewares - Array of middleware functions to restore
   */
  restore(middlewares: MiddlewareFunction<T>[]): void {
    this.middlewares = [...middlewares];
  }

  /**
   * Insert middleware at a specific position
   * @param middleware - The middleware to insert
   * @param index - The position to insert at
   * @returns The chain instance for chaining
   */
  insert(middleware: MiddlewareFunction<T>, index: number): this {
    if (index >= 0 && index <= this.middlewares.length) {
      this.middlewares.splice(index, 0, middleware);
    } else {
      // If index is out of bounds, add to the end
      this.middlewares.push(middleware);
    }
    return this;
  }

  /**
   * Prepend middleware to the beginning of the chain
   * @param middleware - The middleware to prepend
   * @returns The chain instance for chaining
   */
  prepend(middleware: MiddlewareFunction<T>): this {
    return this.insert(middleware, 0);
  }
}

/**
 * Compose multiple middleware functions into a single chain
 * This is a utility function for creating composed middleware
 *
 * @template T - The context type
 * @param middlewares - Array of middleware functions
 * @returns A function that executes the middleware chain
 *
 * @example
 * ```typescript
 * const composed = compose([
 *   async (ctx, next) => { console.log('1'); await next(); },
 *   async (ctx, next) => { console.log('2'); await next(); },
 * ]);
 *
 * await composed({ value: 1 });
 * ```
 */
export function compose<T = unknown>(
  middlewares: MiddlewareFunction<T>[]
): (context: T) => Promise<void> {
  const chain = new MiddlewareChain<T>();

  for (const middleware of middlewares) {
    chain.use(middleware);
  }

  return (context: T) => chain.execute(context);
}
