/**
 * @fileoverview Agent Orchestrator - Core AI agent coordination and execution
 * @module domain/agent/orchestrator
 */

import { EventEmitter } from 'events';
import { v4 as uuidv4 } from 'uuid';

import type { IModelProvider } from '../../infrastructure/model-provider/interface.js';
import type { IContextManager } from '../context/interface.js';
import type { IMemoryManager } from '../memory/interface.js';
import { HookEvent, type IHooksManager } from '../hooks/interface.js';
import type { IToolExecutor } from '../../infrastructure/tool-executor/interface.js';
import type {
  ChatMessage,
  ToolCall,
  ToolResult,
  AgentConfig,
  TokenUsage,
} from './types.js';
import { MessageRole } from './types.js';
import { createLogger } from '../../infrastructure/logging/logger.js';

const logger = createLogger('Orchestrator');

/**
 * Default system prompt for YuGAgent
 */
export const DEFAULT_SYSTEM_PROMPT = `你是 YuGAgent，一个运行在开发者终端中的 AI 助手。

你的职责是帮助开发者完成以下任务：
- 阅读和理解本地代码
- 执行终端命令（在安全规则范围内）
- 分析和排查问题
- 协助代码修改

## 重要：输出格式要求

**你必须始终用中文回复用户。**

在调用工具之前，你必须先用自然语言告诉用户你将要做什么。

在工具执行完成后，你必须分析结果并向用户报告。

**不要只调用工具而不说话**。每次工具调用前后，都应该有相应的文本说明。

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

    // 初始化 Hook 事件桥接（HooksManager -> EventEmitter）
    this.setupHookEventBridge();

  }

  /**
   * 建立 Hook 事件桥接，将 HooksManager 生命周期事件转发到 Orchestrator EventEmitter。
   *
   * 目的：上层 AIService/UI 通过 orchestrator.on(...) 监听时，能够拿到实时事件。
   */
  private setupHookEventBridge(): void {
    // step1. 遍历所有 HookEvent，逐一注册桥接处理器
    for (const event of Object.values(HookEvent)) {
      this.hooksManager.on(event, (context) => {
        // step2. 转发事件到 Orchestrator 自身的 EventEmitter
        this.emit(event, context);

        // step3. 记录关键调试日志，便于排查 UI 实时刷新问题
        logger.debug('Hook 事件已桥接转发', {
          event,
          sessionId: context.sessionId,
          messageCount: context.messages.length,
        });
      });
    }
  }

  /**
   * Initialize the context with the system prompt
   */
  private initializeContext(): void {
    const systemMessage: ChatMessage = {
      role: MessageRole.SYSTEM,
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
   * Validate user input before processing
   * @param userInput - The user's input to validate
   * @throws Error if input is invalid
   */
  private validateUserInput(userInput: string): void {
    // step1. 检查输入类型
    if (typeof userInput !== 'string') {
      throw new Error('User input must be a string');
    }

    // step2. 检查输入长度（空或仅空白）
    const trimmedInput = userInput.trim();
    if (trimmedInput.length === 0) {
      throw new Error('User input cannot be empty');
    }

    // step3. 检查最大长度限制（防止内存溢出）
    const MAX_INPUT_LENGTH = 100000; // 100KB
    if (userInput.length > MAX_INPUT_LENGTH) {
      throw new Error(`User input exceeds maximum length of ${MAX_INPUT_LENGTH} characters`);
    }

    // step4. 检查合理的字符范围（防止控制字符攻击）
    const controlCharPattern = /[\x00-\x08\x0B-\x0C\x0E-\x1F\x7F]/;
    if (controlCharPattern.test(userInput)) {
      throw new Error('User input contains invalid control characters');
    }
  }

  /**
   * Process user input and return the agent's response
   *
   * @param userInput - The user's input text
   * @returns Promise resolving to the thought loop result
   */
  async processUserInput(userInput: string): Promise<ThoughtLoopResult> {
    // step1. 验证用户输入
    this.validateUserInput(userInput);
    logger.info('开始处理用户输入', { inputLength: userInput.length });

    // step2. 检查是否正在处理
    if (this.processingState.isProcessing) {
      throw new Error('Agent is already processing a request');
    }

    this.processingState.isProcessing = true;
    this.processingState.currentIteration = 0;
    this.processingState.lastError = undefined;

    try {
      logger.debug('触发 start hook');
      // Trigger start hook
      await this.hooksManager.emit('start' as any, {
        sessionId: this.sessionId,
        messages: this.contextManager.getMessages(),
        data: { userInput },
      });

      // Add user message to context
      const userMessage: ChatMessage = {
        role: MessageRole.USER,
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
        sessionId: this.sessionId,
        messages: this.contextManager.getMessages(),
        data: { result },
      });

      return result;
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      this.processingState.lastError = err;

      // Trigger error hook
      await this.hooksManager.emit('error' as any, {
        sessionId: this.sessionId,
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

    logger.debug('开始思考循环', { maxIterations: this.maxThoughtIterations });

    for (iteration = 0; iteration < this.maxThoughtIterations; iteration++) {
      this.processingState.currentIteration = iteration + 1;
      logger.info(`=== 思考迭代 ${iteration + 1}/${this.maxThoughtIterations} ===`);

      // Trigger thinking hook
      await this.hooksManager.emit('thinking' as any, {
        sessionId: this.sessionId,
        messages: this.contextManager.getMessages(),
        data: { iteration: iteration + 1 },
      });

      // Get current messages from context
      const messages = this.contextManager.getMessages();

      // Trigger before send hook
      await this.hooksManager.emit('beforeSend' as any, {
        sessionId: this.sessionId,
        messages,
        data: { iteration: iteration + 1 },
      });

      logger.debug('调用模型（流式）', {
        messageCount: messages.length,
        model: this.config.model,
      });

      // step1. 使用流式 API 获取模型响应
      let currentText = '';
      let currentToolCalls: typeof allToolCalls = [];
      let currentFinishReason: ModelCompleteResponse['finishReason'] = 'stop';

      // step2. 遍历流式响应
      for await (const chunk of this.modelProvider.stream({
        messages,
        model: this.config.model,
        temperature: this.config.temperature,
        maxTokens: this.config.maxTokens,
        topP: this.config.topP,
        tools: this.getToolDefinitions(),
        toolChoice: 'auto',
      })) {
        // step3. 累积文本内容
        if (chunk.text) {
          currentText += chunk.text;

          // step4. 实时发出内容块事件
          await this.hooksManager.emit('contentChunk' as any, {
            sessionId: this.sessionId,
            messages: this.contextManager.getMessages(),
            data: {
              iteration: iteration + 1,
              content: chunk.text,
              isComplete: false,
            },
          });
        }

        // step5. 收集最终数据（仅在最后一个块中）
        if (chunk.isComplete) {
          // 收集工具调用
          if (chunk.toolCalls && chunk.toolCalls.length > 0) {
            // 添加预解析的 args
            currentToolCalls = chunk.toolCalls.map(tc => ({
              ...tc,
              // arguments 可能是字符串或对象，安全处理
              args: tc.arguments
                ? (typeof tc.arguments === 'string' ? JSON.parse(tc.arguments) : tc.arguments)
                : undefined,
            }));
          }

          // 获取 finishReason
          if (chunk.finishReason) {
            currentFinishReason = chunk.finishReason;
          }

          // step6. 累积 token 使用量
          if (chunk.usage) {
            totalTokenUsage.promptTokens += chunk.usage.promptTokens;
            totalTokenUsage.completionTokens += chunk.usage.completionTokens;
            totalTokenUsage.totalTokens += chunk.usage.totalTokens;
          }

          logger.info('模型流式响应完成', {
            textLength: currentText.length,
            toolCallsCount: currentToolCalls.length,
            finishReason: currentFinishReason,
            tokens: chunk.usage,
          });
        }
      }

      logger.info('流式处理循环结束', {
        textLength: currentText.length,
        toolCallsCount: currentToolCalls.length,
        finishReason: currentFinishReason,
      });

      // step7. 如果有工具调用但没有文本，自动生成说明文本
      if (currentToolCalls.length > 0 && currentText.length === 0) {
        const toolDescriptions = currentToolCalls.map(tc => {
          const toolName = tc.name;
          // 根据工具类型生成中文说明
          switch (toolName) {
            case 'terminal':
              const cmd = (tc.args as any)?.command || '';
              return `执行命令：\`${cmd}\``;
            case 'file-read':
              const path = (tc.args as any)?.path || '';
              return `读取文件：\`${path}\``;
            case 'directory-list':
              const dirPath = (tc.args as any)?.path || '.';
              return `列出目录：\`${dirPath}\``;
            default:
              return `调用工具：${toolName}`;
          }
        });
        currentText = toolDescriptions.join('\n\n');

        // 触发流式输出事件，让 UI 实时显示
        await this.hooksManager.emit('contentChunk' as any, {
          sessionId: this.sessionId,
          messages: this.contextManager.getMessages(),
          data: {
            iteration: iteration + 1,
            content: currentText,
            isComplete: true,
          },
        });

        logger.debug('自动生成工具调用说明文本', { text: currentText });
      }

      // step8. 触发 after receive hook
      await this.hooksManager.emit('afterReceive' as any, {
        sessionId: this.sessionId,
        messages,
        data: {
          iteration: iteration + 1,
          response: {
            text: currentText,
            toolCalls: currentToolCalls,
            usage: totalTokenUsage,
            finishReason: currentFinishReason,
          },
        },
      });

      // step9. 添加助手响应到上下文
      const assistantMessage: ChatMessage = {
        role: MessageRole.ASSISTANT,
        content: currentText,
        toolCalls: currentToolCalls.length > 0 ? currentToolCalls : undefined,
        metadata: {
          sessionId: this.sessionId,
          timestamp: new Date().toISOString(),
          tokenUsage: totalTokenUsage,
          finishReason: currentFinishReason,
        },
      };

      this.contextManager.addMessage(assistantMessage);

      // step9.1 触发消息更新事件，让 UI 立即显示助手消息
      await this.hooksManager.emit('messagesUpdate' as any, {
        sessionId: this.sessionId,
        messages: this.contextManager.getMessages(),
        data: {
          iteration: iteration + 1,
          isComplete: false,
          hasToolCalls: currentToolCalls.length > 0,
        },
      });

      // step10. 检查是否有工具调用
      if (currentToolCalls.length > 0) {
        logger.info(`检测到工具调用`, {
          toolNames: currentToolCalls.map(tc => tc.name),
          textLength: currentText.length,
        });
        const toolNames = currentToolCalls.map(tc => tc.name);
        logger.info(`执行工具: ${toolNames.join(', ')}`, { count: currentToolCalls.length });

        allToolCalls.push(...currentToolCalls);

        // step11. 执行工具调用
        const toolResults = await this.executeToolCalls(currentToolCalls);
        allToolResults.push(...toolResults);

        // step12. 添加工具结果到上下文
        for (const result of toolResults) {
          const toolMessage: ChatMessage = {
            role: MessageRole.TOOL,
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

        // step12.1 触发消息更新事件，让 UI 立即显示当前的消息状态
        await this.hooksManager.emit('messagesUpdate' as any, {
          sessionId: this.sessionId,
          messages: this.contextManager.getMessages(),
          data: {
            iteration: iteration + 1,
            toolResults,
            isComplete: false,
          },
        });

        // step13. 继续循环
        logger.info('工具执行完成，继续思考循环');
        continue;
      }

      // step14. 无工具调用 - 这是最终响应
      finalResponse = currentText;
      break;
    }

    // step15. 检查是否达到最大迭代次数
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

    logger.debug(`开始执行 ${toolCalls.length} 个工具调用`);

    for (const toolCall of toolCalls) {
      // 打印详细的工具调用信息用于调试
      logger.info(`→ 执行工具: ${toolCall.name}`, {
        id: toolCall.id,
        arguments: toolCall.arguments,
        args: toolCall.args,
        argsLength: toolCall.arguments?.length || 0,
      });

      // Check if tool is allowed
      if (!this.allowedTools.has(toolCall.name)) {
        logger.warn(`工具 ${toolCall.name} 不在允许列表中`);
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
        // step1. 尝试使用预解析的参数
        args = toolCall.args ?? JSON.parse(toolCall.arguments);

        // step2. 验证解析后的参数是对象类型
        if (typeof args !== 'object' || args === null) {
          throw new Error('Tool arguments must be a valid object');
        }

        // step3. 验证参数大小（防止 DoS）
        const argsString = JSON.stringify(args);
        if (argsString.length > 100000) { // 100KB 限制
          throw new Error('Tool arguments exceed maximum size');
        }

        // step4. 验证参数数量
        const paramCount = Object.keys(args).length;
        if (paramCount > 100) {
          throw new Error('Too many parameters (max: 100)');
        }

        logger.debug(`工具 ${toolCall.name} 参数解析成功`, {
          paramCount,
          argsSize: argsString.length,
        });
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        logger.error(`工具 ${toolCall.name} 参数解析失败: ${errorMessage}`, error);
        const result: ToolResult = {
          toolCallId: toolCall.id,
          toolName: toolCall.name,
          success: false,
          error: `Failed to parse tool arguments: ${errorMessage}`,
        };
        results.push(result);
        continue;
      }

      // Trigger before tool hook
      await this.hooksManager.emit('beforeTool' as any, {
        sessionId: this.sessionId,
        messages: this.contextManager.getMessages(),
        toolCall,
        data: { args },
      });

      // Trigger security check hook
      await this.hooksManager.emit('securityCheck' as any, {
        sessionId: this.sessionId,
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

        if (response.result.success) {
          logger.info(`✓ 工具 ${toolCall.name} 执行成功`, {
            duration: `${duration}ms`,
            outputSize: result.output?.length || 0,
          });
        } else {
          logger.warn(`✗ 工具 ${toolCall.name} 执行失败: ${response.result.error}`);
        }

        // Trigger after tool hook
        await this.hooksManager.emit('afterTool' as any, {
          sessionId: this.sessionId,
          messages: this.contextManager.getMessages(),
          toolCall,
          toolResult: result,
          data: { args },
        });
      } catch (error) {
        const duration = Date.now() - startTime;
        const err = error instanceof Error ? error : new Error(String(error));

        logger.error(`✗ 工具 ${toolCall.name} 执行异常`, err);

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
          sessionId: this.sessionId,
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
