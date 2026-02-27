/**
 * @fileoverview Agent Orchestrator - Core AI agent coordination and execution
 * @module domain/agent/orchestrator
 */

import { EventEmitter } from 'events';
import { v4 as uuidv4 } from 'uuid';

import type { IModelProvider } from '../../infrastructure/model-provider/interface.js';
import type { IContextManager } from '../context/interface.js';
import type { IMemoryManager } from '../memory/interface.js';
import type { IHooksManager } from '../hooks/interface.js';
import type { IToolExecutor } from '../../infrastructure/tool-executor/interface.js';
import type {
  ChatMessage,
  ToolCall,
  ToolResult,
  AgentConfig,
  TokenUsage,
} from './types.js';

/**
 * Default system prompt for YuGAgent
 */
export const DEFAULT_SYSTEM_PROMPT = `你是 YuGAgent，一个运行在开发者终端中的 AI 助手。

你的职责是帮助开发者完成以下任务：
- 阅读和理解本地代码
- 执行终端命令（在安全规则范围内）
- 分析和排查问题
- 协助代码修改

请始终以简洁、专业的方式回答问题。`;

/**
 * Maximum number of thought loop iterations
 */
export const MAX_THOUGHT_ITERATIONS = 10;

/**
 * Orchestrator options
 */
export interface OrchestratorOptions {
  /** Agent configuration */
  config: AgentConfig;
  /** Session ID for this orchestrator instance */
  sessionId?: string;
  /** Initial system prompt */
  systemPrompt?: string;
  /** Allowed tools for this session */
  allowedTools?: string[];
  /** Maximum thought iterations */
  maxThoughtIterations?: number;
}

/**
 * Processing state
 */
export interface ProcessingState {
  /** Whether currently processing */
  isProcessing: boolean;
  /** Current thought iteration */
  currentIteration: number;
  /** Last error */
  lastError?: Error;
}

/**
 * Thought loop result
 */
export interface ThoughtLoopResult {
  /** Final response text */
  response: string;
  /** Number of iterations performed */
  iterations: number;
  /** All tool calls made during the loop */
  toolCalls: ToolCall[];
  /** All tool results */
  toolResults: ToolResult[];
  /** Token usage statistics */
  tokenUsage: TokenUsage;
  /** Whether the loop completed successfully */
  success: boolean;
  /** Error if failed */
  error?: Error;
}

/**
 * Agent Orchestrator - Core coordination and execution engine
 *
 * The orchestrator is responsible for:
 * - Managing the thought loop (think -> act -> observe)
 * - Coordinating between model provider, context, memory, hooks, and tools
 * - Emitting lifecycle events for UI integration
 * - Enforcing security rules and tool permissions
 */
export class AgentOrchestrator extends EventEmitter {
  private readonly modelProvider: IModelProvider;
  private readonly contextManager: IContextManager;
  private readonly memoryManager: IMemoryManager;
  private readonly hooksManager: IHooksManager;
  private readonly toolExecutor: IToolExecutor;
  private readonly config: AgentConfig;
  private readonly sessionId: string;
  private readonly systemPrompt: string;
  private readonly allowedTools: Set<string>;
  private readonly maxThoughtIterations: number;

  private processingState: ProcessingState = {
    isProcessing: false,
    currentIteration: 0,
  };

  constructor(
    modelProvider: IModelProvider,
    contextManager: IContextManager,
    memoryManager: IMemoryManager,
    hooksManager: IHooksManager,
    toolExecutor: IToolExecutor,
    options: OrchestratorOptions
  ) {
    super();

    this.modelProvider = modelProvider;
    this.contextManager = contextManager;
    this.memoryManager = memoryManager;
    this.hooksManager = hooksManager;
    this.toolExecutor = toolExecutor;
    this.config = options.config;
    this.sessionId = options.sessionId || uuidv4();
    this.systemPrompt = options.systemPrompt || DEFAULT_SYSTEM_PROMPT;
    this.allowedTools = new Set(options.allowedTools || []);
    this.maxThoughtIterations = options.maxThoughtIterations ?? MAX_THOUGHT_ITERATIONS;

    // Initialize context with system prompt
    this.initializeContext();
  }

  /**
   * Initialize the context with the system prompt
   */
  private initializeContext(): void {
    const systemMessage: ChatMessage = {
      role: 'system' as any,
      content: this.buildSystemPrompt(),
      metadata: {
        sessionId: this.sessionId,
        timestamp: new Date().toISOString(),
      },
    };

    this.contextManager.addMessage(systemMessage);
    this.contextManager.setSystemPrompt(this.systemPrompt);
  }

  /**
   * Process user input and return the agent's response
   *
   * @param userInput - The user's input text
   * @returns Promise resolving to the thought loop result
   */
  async processUserInput(userInput: string): Promise<ThoughtLoopResult> {
    if (this.processingState.isProcessing) {
      throw new Error('Agent is already processing a request');
    }

    this.processingState.isProcessing = true;
    this.processingState.currentIteration = 0;
    delete this.processingState.lastError;

    try {
      // Trigger start hook
      await this.hooksManager.emit('start' as any, {
        event: 'start' as any,
        sessionId: this.sessionId,
        timestamp: new Date(),
        messages: this.contextManager.getMessages(),
        data: { userInput },
      });

      // Add user message to context
      const userMessage: ChatMessage = {
        role: 'user' as any,
        content: userInput,
        metadata: {
          sessionId: this.sessionId,
          timestamp: new Date().toISOString(),
        },
      };

      this.contextManager.addMessage(userMessage);

      // Run thought loop
      const result = await this.thoughtLoop();

      // Trigger complete hook
      await this.hooksManager.emit('complete' as any, {
        event: 'complete' as any,
        sessionId: this.sessionId,
        timestamp: new Date(),
        messages: this.contextManager.getMessages(),
        data: { result },
      });

      return result;
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      this.processingState.lastError = err;

      // Trigger error hook
      await this.hooksManager.emit('error' as any, {
        event: 'error' as any,
        sessionId: this.sessionId,
        timestamp: new Date(),
        messages: this.contextManager.getMessages(),
        error: err,
        data: {},
      });

      throw err;
    } finally {
      this.processingState.isProcessing = false;
    }
  }

  /**
   * Thought loop - the core reasoning and execution cycle
   *
   * Implements: Think -> Act (tool calls) -> Observe -> Repeat
   *
   * @returns Promise resolving to the thought loop result
   */
  private async thoughtLoop(): Promise<ThoughtLoopResult> {
    const allToolCalls: ToolCall[] = [];
    const allToolResults: ToolResult[] = [];
    let totalTokenUsage: TokenUsage = {
      promptTokens: 0,
      completionTokens: 0,
      totalTokens: 0,
    };
    let finalResponse = '';
    let iteration = 0;

    for (iteration = 0; iteration < this.maxThoughtIterations; iteration++) {
      this.processingState.currentIteration = iteration + 1;

      // Trigger thinking hook
      await this.hooksManager.emit('thinking' as any, {
        event: 'thinking' as any,
        sessionId: this.sessionId,
        timestamp: new Date(),
        messages: this.contextManager.getMessages(),
        data: { iteration: iteration + 1 },
      });

      // Get current messages from context
      const messages = this.contextManager.getMessages();

      // Trigger before send hook
      await this.hooksManager.emit('beforeSend' as any, {
        event: 'beforeSend' as any,
        sessionId: this.sessionId,
        timestamp: new Date(),
        messages,
        data: { iteration: iteration + 1 },
      });

      // Call model
      const modelResponse = await this.modelProvider.complete({
        messages,
        model: this.config.model,
        temperature: this.config.temperature,
        maxTokens: this.config.maxTokens,
        topP: this.config.topP,
        tools: this.getToolDefinitions(),
        toolChoice: 'auto',
      });

      // Accumulate token usage
      totalTokenUsage.promptTokens += modelResponse.usage.promptTokens;
      totalTokenUsage.completionTokens += modelResponse.usage.completionTokens;
      totalTokenUsage.totalTokens += modelResponse.usage.totalTokens;

      // Trigger after receive hook
      await this.hooksManager.emit('afterReceive' as any, {
        event: 'afterReceive' as any,
        sessionId: this.sessionId,
        timestamp: new Date(),
        messages,
        data: {
          iteration: iteration + 1,
          response: modelResponse,
        },
      });

      // Add assistant response to context
      const assistantMessage: ChatMessage = {
        role: 'assistant' as any,
        content: modelResponse.text,
        toolCalls: modelResponse.toolCalls,
        metadata: {
          sessionId: this.sessionId,
          timestamp: new Date().toISOString(),
          tokenUsage: modelResponse.usage,
          finishReason: modelResponse.finishReason,
        },
      };

      this.contextManager.addMessage(assistantMessage);

      // Check if model made tool calls
      if (modelResponse.toolCalls && modelResponse.toolCalls.length > 0) {
        allToolCalls.push(...modelResponse.toolCalls);

        // Execute tool calls
        const toolResults = await this.executeToolCalls(modelResponse.toolCalls);
        allToolResults.push(...toolResults);

        // Add tool results to context
        for (const result of toolResults) {
          const toolMessage: ChatMessage = {
            role: 'tool' as any,
            content: result.success ? (result.output ?? '') : (result.error ?? 'Tool execution failed'),
            toolCallId: result.toolCallId,
            metadata: {
              sessionId: this.sessionId,
              timestamp: new Date().toISOString(),
              toolName: result.toolName,
              success: result.success,
              duration: result.duration,
            },
          };

          this.contextManager.addMessage(toolMessage);
        }

        // Continue the loop
        continue;
      }

      // No tool calls - this is the final response
      finalResponse = modelResponse.text;
      break;
    }

    // Check if we hit max iterations
    if (iteration >= this.maxThoughtIterations && !finalResponse) {
      finalResponse = 'I reached the maximum number of thinking iterations. Please provide more context or simplify your request.';
    }

    return {
      response: finalResponse,
      iterations: iteration + 1,
      toolCalls: allToolCalls,
      toolResults: allToolResults,
      tokenUsage: totalTokenUsage,
      success: true,
    };
  }

  /**
   * Execute tool calls with security checks
   *
   * @param toolCalls - Tool calls to execute
   * @returns Promise resolving to tool results
   */
  private async executeToolCalls(toolCalls: ToolCall[]): Promise<ToolResult[]> {
    const results: ToolResult[] = [];

    for (const toolCall of toolCalls) {
      // Check if tool is allowed
      if (!this.allowedTools.has(toolCall.name)) {
        const result: ToolResult = {
          toolCallId: toolCall.id,
          toolName: toolCall.name,
          success: false,
          error: `Tool "${toolCall.name}" is not allowed in this session`,
        };
        results.push(result);
        continue;
      }

      // Parse arguments
      let args: Record<string, unknown>;
      try {
        args = toolCall.args ?? JSON.parse(toolCall.arguments);
      } catch (error) {
        const result: ToolResult = {
          toolCallId: toolCall.id,
          toolName: toolCall.name,
          success: false,
          error: `Failed to parse tool arguments: ${error}`,
        };
        results.push(result);
        continue;
      }

      // Trigger before tool hook
      await this.hooksManager.emit('beforeTool' as any, {
        event: 'beforeTool' as any,
        sessionId: this.sessionId,
        timestamp: new Date(),
        messages: this.contextManager.getMessages(),
        toolCall,
        data: { args },
      });

      // Trigger security check hook
      await this.hooksManager.emit('securityCheck' as any, {
        event: 'securityCheck' as any,
        sessionId: this.sessionId,
        timestamp: new Date(),
        messages: this.contextManager.getMessages(),
        toolCall,
        data: { args },
      });

      const startTime = Date.now();

      try {
        // Execute the tool
        const response = await this.toolExecutor.execute({
          toolName: toolCall.name,
          parameters: args,
          context: {
            sessionId: this.sessionId,
            workingDirectory: process.cwd(),
          },
        });

        const duration = Date.now() - startTime;

        const result: ToolResult = {
          toolCallId: toolCall.id,
          toolName: toolCall.name,
          success: response.result.success,
          output: response.result.success ? JSON.stringify(response.result.data) : undefined,
          error: response.result.error,
          duration,
          metadata: {
            executionTime: response.result.metadata?.executionTime,
            outputSize: response.result.metadata?.outputSize,
            exitCode: response.result.metadata?.exitCode,
          },
        };

        results.push(result);

        // Trigger after tool hook
        await this.hooksManager.emit('afterTool' as any, {
          event: 'afterTool' as any,
          sessionId: this.sessionId,
          timestamp: new Date(),
          messages: this.contextManager.getMessages(),
          toolCall,
          toolResult: result,
          data: { args },
        });
      } catch (error) {
        const duration = Date.now() - startTime;
        const err = error instanceof Error ? error : new Error(String(error));

        const result: ToolResult = {
          toolCallId: toolCall.id,
          toolName: toolCall.name,
          success: false,
          error: err.message,
          duration,
        };

        results.push(result);

        // Trigger tool error hook
        await this.hooksManager.emit('toolError' as any, {
          event: 'toolError' as any,
          sessionId: this.sessionId,
          timestamp: new Date(),
          messages: this.contextManager.getMessages(),
          toolCall,
          error: err,
          data: { args },
        });
      }
    }

    return results;
  }

  /**
   * Build the system prompt with security rules
   *
   * @returns Complete system prompt string
   */
  private buildSystemPrompt(): string {
    let prompt = this.systemPrompt;

    // Add security rules
    const securityRules = this.buildSecurityPrompt();
    if (securityRules) {
      prompt += '\n\n## 安全规则\n\n' + securityRules;
    }

    // Add available tools info
    const toolsInfo = this.getToolsInfo();
    if (toolsInfo) {
      prompt += '\n\n## 可用工具\n\n' + toolsInfo;
    }

    return prompt;
  }

  /**
   * Build security rules prompt
   *
   * @returns Security rules string
   */
  private buildSecurityPrompt(): string {
    const rules = this.toolExecutor.getSecurityRules();
    if (rules.length === 0) {
      return '严格遵守安全规则，不要执行可能造成数据损坏或安全风险的命令。';
    }

    const rulesText = rules
      .filter((rule) => rule.enabled)
      .map((rule) => `- ${rule.description} (${rule.severity})`)
      .join('\n');

    return `执行命令和工具前必须遵守以下安全规则：\n\n${rulesText}\n\n对于高风险操作，必须获得用户明确授权。`;
  }

  /**
   * Get information about available tools
   *
   * @returns Tools info string
   */
  private getToolsInfo(): string {
    const tools = Array.from(this.allowedTools);
    return `你可以使用以下工具：\n\n${tools.map((t) => `- \`${t}\``).join('\n')}`;
  }

  /**
   * Get tool definitions for the model
   *
   * @returns Array of tool definitions
   */
  private getToolDefinitions(): Array<{ id: string; name: string; description: string; parameters?: Record<string, unknown> }> {
    const definitions: Array<{ id: string; name: string; description: string; parameters?: Record<string, unknown> }> = [];
    const registeredTools = this.toolExecutor.getTools();

    for (const toolName of this.allowedTools) {
      const tool = registeredTools.get(toolName);
      if (tool) {
        definitions.push({
          id: tool.name,
          name: tool.name,
          description: tool.description,
          parameters: tool.inputSchema,
        });
      }
    }

    return definitions;
  }

  /**
   * Check if the orchestrator is currently processing
   *
   * @returns True if processing
   */
  isProcessing(): boolean {
    return this.processingState.isProcessing;
  }

  /**
   * Get the set of allowed tools
   *
   * @returns Set of allowed tool names
   */
  getAllowedTools(): Set<string> {
    return new Set(this.allowedTools);
  }

  /**
   * Get the current system prompt
   *
   * @returns System prompt string
   */
  getSystemPrompt(): string {
    return this.systemPrompt;
  }

  /**
   * Get the model provider
   *
   * @returns Model provider instance
   */
  getModelProvider(): IModelProvider {
    return this.modelProvider;
  }

  /**
   * Get the context manager
   *
   * @returns Context manager instance
   */
  getContext(): IContextManager {
    return this.contextManager;
  }

  /**
   * Get the session ID
   *
   * @returns Session ID
   */
  getSessionId(): string {
    return this.sessionId;
  }

  /**
   * Get the current configuration
   *
   * @returns Agent configuration
   */
  getConfig(): AgentConfig {
    return { ...this.config };
  }

  /**
   * Get processing state
   *
   * @returns Current processing state
   */
  getProcessingState(): ProcessingState {
    return { ...this.processingState };
  }
}
