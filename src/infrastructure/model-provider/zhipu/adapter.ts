/**
 * @fileoverview Zhipu AI model provider adapter using Vercel AI SDK
 * @module infrastructure/model-provider/zhipu/adapter
 */

import { createOpenAI } from '@ai-sdk/openai';
import { generateText, streamText } from 'ai';
import type { LanguageModelV1 } from '@ai-sdk/provider';
import { z } from 'zod';
import type { ChatMessage } from '../../../domain/agent/types.js';
import { TokenCounter } from '../../../domain/memory/token-counter.js';
import type {
  HealthCheckResult,
  IModelProvider,
  ModelCompleteRequest,
  ModelCompleteResponse,
  StreamChunk,
} from '../interface.js';
import type { ZhipuConfig } from './config.js';
import { createLogger } from '../../logging/logger.js';

const logger = createLogger('ZhipuAdapter');

/**
 * Zhipu AI Model Provider implementation
 * Uses @ai-sdk/openai for OpenAI-compatible API (Zhipu supports OpenAI format)
 */
export class ZhipuModelProvider implements IModelProvider {
  /** Provider identifier */
  readonly providerId = 'zhipu';

  private readonly config: ZhipuConfig;
  private readonly client: ReturnType<typeof createOpenAI>;
  private readonly tokenCounter: TokenCounter;

  /**
   * Create a new ZhipuModelProvider instance
   * @param config - Zhipu AI configuration
   */
  constructor(config: ZhipuConfig) {
    this.config = config;
    this.tokenCounter = new TokenCounter();

    // Create OpenAI-compatible client for Zhipu AI
    // 使用 strict 兼容模式以正确处理智谱 AI 的响应格式
    this.client = createOpenAI({
      baseURL: config.baseURL,
      apiKey: config.apiKey,
      compatibility: 'strict',
    });
  }

  /**
   * Get a language model instance for the given model name
   * @param modelName - Model name (defaults to glm-4.7)
   * @returns Language model instance
   */
  private getModel(modelName?: string): LanguageModelV1 {
    const model = this.client.chat(modelName || this.config.model || 'glm-4.7');
    return model as LanguageModelV1;
  }

  /**
   * Get the current configuration
   */
  getConfig(): ZhipuConfig {
    return { ...this.config };
  }

  /**
   * Complete a model request (non-streaming)
   * @param request - Model completion request
   * @returns Promise resolving to model completion response
   */
  async complete(request: ModelCompleteRequest): Promise<ModelCompleteResponse> {
    try {
      // step1. 验证请求参数
      this.validateRequest(request);

      // step2. 转换域消息到 AI SDK 格式
      const messages = this.convertMessagesToAISDK(request.messages);

      // step3. 获取模型实例
      const model = this.getModel(request.model);

      // step4. 构建生成参数
      const generationParams: any = {
        model,
        messages,
        temperature: request.temperature ?? 0.7,
        maxTokens: request.maxTokens ?? 4096,
      };

      // 只添加有值的可选参数
      if (request.topP !== undefined) {
        generationParams.topP = request.topP;
      }
      if (request.stopSequences) {
        generationParams.stop = request.stopSequences;
      }
      if (request.tools) {
        const convertedTools = this.convertToolsToAISDK(request.tools);
        generationParams.tools = convertedTools;
        // 调试日志：记录转换后的工具定义
        logger.debug('工具定义已转换为 AI SDK 格式', {
          toolsCount: convertedTools.length,
          tools: JSON.stringify(convertedTools, null, 2),
        });
      }
      if (request.toolChoice) {
        generationParams.toolChoice = request.toolChoice;
      }
      if (request.headers) {
        generationParams.headers = request.headers;
      }

      // 调试日志：记录完整的请求参数
      logger.debug('发送到智谱 AI 的请求参数', {
        hasTools: !!generationParams.tools,
        toolsCount: generationParams.tools?.length ?? 0,
        toolChoice: generationParams.toolChoice,
        temperature: generationParams.temperature,
        maxTokens: generationParams.maxTokens,
      });

      // step5. 使用 AI SDK 生成文本
      const result = await generateText(generationParams);

      // step5.5 调试日志 - 记录原始响应
      logger.debug('智谱 AI 原始响应', {
        hasToolCalls: !!result.toolCalls,
        toolCallsLength: result.toolCalls?.length ?? 0,
        finishReason: result.finishReason,
        textLength: result.text?.length ?? 0,
        rawToolCalls: JSON.stringify(result.toolCalls),
      });

      // step6. 构建响应
      const response: ModelCompleteResponse = {
        text: result.text,
        usage: {
          promptTokens: result.usage?.promptTokens ?? 0,
          completionTokens: result.usage?.completionTokens ?? 0,
          totalTokens: result.usage?.totalTokens ?? 0,
        },
        finishReason: this.mapFinishReason(result.finishReason),
        model: request.model || this.config.model || 'glm-4.7',
        id: (result as any).id ?? undefined,
      };

      // step7. 添加工具调用（如果有）
      if (result.toolCalls && result.toolCalls.length > 0) {
        response.toolCalls = result.toolCalls
          .map((tc) => {
            // 获取工具名称 - 处理智谱 AI SDK 返回 toolName="0" 的问题
            let toolName = tc.toolName;

            // 尝试从原始响应的多个字段获取工具名称
            if (!toolName || typeof toolName !== 'string' || toolName === '0') {
              const rawTc = tc as any;
              logger.debug('toolName 无效，尝试从其他字段获取', {
                toolName,
                toolCallId: tc.toolCallId,
                rawKeys: Object.keys(rawTc),
              });

              // 尝试从多个可能的字段获取工具名称
              if (rawTc.function?.name) {
                toolName = rawTc.function.name;
              } else if (rawTc.tool) {
                toolName = rawTc.tool;
              } else if (rawTc.name) {
                toolName = rawTc.name;
              }

              // 根据 args 的内容推断工具名称（智谱 AI SDK 的 bug 回退）
              if (!toolName || toolName === '0') {
                const args = tc.args;
                if (typeof args === 'object' && args !== null) {
                  // 根据参数特征推断工具类型
                  if ('command' in args) {
                    toolName = 'terminal';
                  } else if ('path' in args && 'startLine' in args) {
                    toolName = 'file-read';
                  } else if ('path' in args && ('recursive' in args || 'depth' in args)) {
                    toolName = 'directory-list';
                  }
                }
                logger.debug('根据 args 内容推断工具名称', {
                  inferredToolName: toolName,
                  argsKeys: typeof args === 'object' ? Object.keys(args) : [],
                });
              }
            }

            // 如果仍然没有有效的工具名称，记录警告并跳过
            if (!toolName || typeof toolName !== 'string' || toolName === '0') {
              logger.warn('无法获取有效的工具名称，跳过此工具调用', {
                toolName,
                toolCallId: tc.toolCallId,
                args: tc.args,
              });
              return null;
            }

            // 处理工具调用参数：args 可能是对象或字符串
            let argumentsStr: string;
            if (typeof tc.args === 'string') {
              argumentsStr = tc.args;
            } else if (typeof tc.args === 'object' && tc.args !== null) {
              argumentsStr = JSON.stringify(tc.args);
            } else {
              argumentsStr = '{}';
            }

            logger.debug('工具调用解析成功', {
              toolName,
              toolCallId: tc.toolCallId,
              argsLength: argumentsStr.length,
            });

            return {
              id: tc.toolCallId,
              name: toolName,
              arguments: argumentsStr,
              // 同时保存预解析的 args 对象供后续使用
              args: tc.args,
            };
          })
          .filter((tc): tc is NonNullable<typeof tc> => tc !== null);
      }

      // step8. 修复 finishReason 与 toolCalls 不一致的问题
      // 如果 finishReason 是 tool_calls 但没有实际的工具调用，这可能是 API 返回了矛盾的响应
      // 此时应该将 finishReason 改为 stop，避免 orchestrator 进入错误的处理流程
      if (response.finishReason === 'tool_calls' && (!response.toolCalls || response.toolCalls.length === 0)) {
        logger.warn('检测到矛盾的模型响应：finishReason 是 tool_calls 但没有实际工具调用，将 finishReason 改为 stop', {
          originalFinishReason: response.finishReason,
          toolCallsCount: response.toolCalls?.length ?? 0,
          textLength: response.text?.length ?? 0,
        });
        response.finishReason = 'stop';
      }

      return response;
    } catch (error) {
      // step8. 增强错误处理，添加更多上下文
      if (error instanceof Error) {
        // 记录原始错误用于调试（生产环境中应该使用日志系统）
        const enhancedError = new Error(`Zhipu AI completion failed: ${error.message}`);
        (enhancedError as any).cause = error;
        (enhancedError as any).requestContext = {
          model: request.model,
          messagesCount: request.messages.length,
          hasTools: !!request.tools,
        };
        throw enhancedError;
      }
      throw new Error('Zhipu AI completion failed with unknown error');
    }
  }

  /**
   * 验证模型请求参数
   * @param request - 要验证的请求
   * @throws Error 如果请求无效
   */
  private validateRequest(request: ModelCompleteRequest): void {
    // step1. 验证消息数组
    if (!request.messages || !Array.isArray(request.messages)) {
      throw new Error('Messages must be a non-empty array');
    }

    if (request.messages.length === 0) {
      throw new Error('Messages array cannot be empty');
    }

    if (request.messages.length > 1000) {
      throw new Error('Too many messages (max: 1000)');
    }

    // step2. 验证每个消息
    for (let i = 0; i < request.messages.length; i++) {
      const msg = request.messages[i];
      if (!msg || typeof msg !== 'object') {
        throw new Error(`Message at index ${i} is invalid`);
      }
      if (!msg.role || typeof msg.role !== 'string') {
        throw new Error(`Message at index ${i} missing valid role`);
      }
      // content 可以是字符串（普通消息）或数组（工具调用/结果）
      if (msg.content === undefined) {
        throw new Error(`Message at index ${i} missing valid content`);
      }
      // 对于字符串类型 content，检查长度
      if (typeof msg.content === 'string' && msg.content.length > 100000) {
        throw new Error(`Message at index ${i} exceeds maximum length`);
      }
    }

    // step3. 验证温度参数
    if (request.temperature !== undefined) {
      if (typeof request.temperature !== 'number') {
        throw new Error('Temperature must be a number');
      }
      if (request.temperature < 0 || request.temperature > 2) {
        throw new Error('Temperature must be between 0 and 2');
      }
    }

    // step4. 验证 maxTokens 参数
    if (request.maxTokens !== undefined) {
      if (typeof request.maxTokens !== 'number') {
        throw new Error('maxTokens must be a number');
      }
      if (request.maxTokens < 1 || request.maxTokens > 128000) {
        throw new Error('maxTokens must be between 1 and 128000');
      }
    }

    // step5. 验证 topP 参数
    if (request.topP !== undefined) {
      if (typeof request.topP !== 'number') {
        throw new Error('topP must be a number');
      }
      if (request.topP < 0 || request.topP > 1) {
        throw new Error('topP must be between 0 and 1');
      }
    }

    // step6. 验证工具参数
    if (request.tools) {
      if (!Array.isArray(request.tools)) {
        throw new Error('Tools must be an array');
      }
      if (request.tools.length > 50) {
        throw new Error('Too many tools (max: 50)');
      }
    }
  }

  /**
   * Stream a model request (streaming)
   * @param request - Model completion request with stream enabled
   * @returns Async generator yielding stream chunks
   */
  async *stream(request: ModelCompleteRequest): AsyncGenerator<StreamChunk> {
    try {
      // step1. 验证请求参数
      this.validateRequest(request);

      // step2. 转换域消息到 AI SDK 格式
      const messages = this.convertMessagesToAISDK(request.messages);

      // step3. 获取模型实例
      const model = this.getModel(request.model);

      // Build generation parameters
      const generationParams: any = {
        model,
        messages,
        temperature: request.temperature ?? 0.7,
        maxTokens: request.maxTokens ?? 4096,
      };

      // 只添加有值的可选参数
      if (request.topP !== undefined) {
        generationParams.topP = request.topP;
      }
      if (request.stopSequences) {
        generationParams.stop = request.stopSequences;
      }
      if (request.tools) {
        generationParams.tools = this.convertToolsToAISDK(request.tools);
      }
      if (request.toolChoice) {
        generationParams.toolChoice = request.toolChoice;
      }
      if (request.headers) {
        generationParams.headers = request.headers;
      }

      // Stream text using AI SDK
      const result = await streamText(generationParams);

      let fullText = '';
      const toolCallsAccumulator: Map<string, { name: string; args: string }> = new Map();

      // 使用 fullStream 而不是 textStream，这样可以同时处理文本和工具调用
      // @ts-ignore - fullStream 存在但类型定义可能不完整
      for await (const chunk of result.fullStream) {
        // 调试日志：记录所有 chunk 类型
        logger.debug('流式 chunk', {
          type: chunk.type,
          hasText: !!(chunk as any).text,
          textLength: (chunk as any).text?.length || 0,
          hasReasoning: !!(chunk as any).reasoning,
          keys: Object.keys(chunk),
        });

        // 处理不同类型的 chunk
        switch (chunk.type) {
          case 'text-delta':
          case 'text':
            if (chunk.text) {
              fullText += chunk.text;
              logger.debug('文本增量', {
                text: chunk.text.substring(0, 50),
                textLength: chunk.text.length,
                fullTextLength: fullText.length,
              });
              yield {
                text: chunk.text,
                isComplete: false,
              };
            }
            break;

          // 处理推理内容（某些模型使用这个类型）
          case 'reasoning-delta':
          case 'reasoning':
            if ((chunk as any).reasoning) {
              const reasoningText = (chunk as any).reasoning;
              fullText += reasoningText;
              logger.debug('推理增量', {
                text: reasoningText.substring(0, 50),
                textLength: reasoningText.length,
                fullTextLength: fullText.length,
              });
              yield {
                text: reasoningText,
                isComplete: false,
              };
            }
            break;

          case 'tool-call-delta':
          case 'tool-call':
            // 工具调用的增量信息，收集起来
            if (chunk.toolCallId && chunk.toolName) {
              // 调试日志：记录工具调用增量
              logger.debug('工具调用增量', {
                toolCallId: chunk.toolCallId,
                toolName: chunk.toolName,
                args: chunk.args,
                argsLength: chunk.args?.length || 0,
              });

              if (!toolCallsAccumulator.has(chunk.toolCallId)) {
                toolCallsAccumulator.set(chunk.toolCallId, {
                  name: chunk.toolName,
                  args: chunk.args || '',
                });
              } else {
                const existing = toolCallsAccumulator.get(chunk.toolCallId)!;
                if (chunk.args) {
                  existing.args += chunk.args;
                }
              }
            }
            break;

          case 'tool-result':
            // 工具执行结果，不需要在这里处理
            break;

          case 'finish':
          case 'error':
            // 结束或错误，在最后处理
            break;
        }
      }

      // Wait for completion to get final metadata
      const finalResult = await result;

      // Collect tool calls from final result - 优先使用 finalResult 中的完整数据
      const toolCalls = (finalResult as any).toolCalls;
      if (toolCalls && toolCalls.length > 0) {
        logger.debug('从 finalResult 获取工具调用', {
          toolCallsCount: toolCalls.length,
          toolCalls: JSON.stringify(toolCalls),
        });

        for (const tc of toolCalls) {
          // 获取工具名称 - 处理可能的格式问题
          let toolName = tc.toolName;
          if (!toolName || typeof toolName !== 'string' || toolName === '0') {
            // 尝试从原始响应的其他字段获取工具名称
            const rawTc = tc as any;
            if (rawTc.function?.name) {
              toolName = rawTc.function.name;
            } else if (rawTc.tool) {
              toolName = rawTc.tool;
            }
          }

          // 如果仍然没有有效的工具名称，跳过此工具调用
          if (!toolName || typeof toolName !== 'string' || toolName === '0') {
            logger.warn('跳过无效的工具名称', { toolName: tc.toolName, toolCallId: tc.toolCallId });
            continue;
          }

          // 处理工具调用参数
          let argsStr: string;
          if (typeof tc.args === 'string') {
            argsStr = tc.args;
          } else if (typeof tc.args === 'object' && tc.args !== null) {
            argsStr = JSON.stringify(tc.args);
          } else {
            argsStr = '{}';
          }

          // 用 finalResult 中的完整数据覆盖 accumulator 中的数据
          // 因为 finalResult 包含完整的工具调用信息，而 delta 可能只有部分数据
          toolCallsAccumulator.set(tc.toolCallId, {
            name: toolName,
            args: argsStr,
          });

          logger.debug('工具调用已添加到 accumulator', {
            toolCallId: tc.toolCallId,
            toolName,
            args: argsStr,
            argsLength: argsStr.length,
          });
        }
      }

      // Get usage info
      const usage = (finalResult as any).usage;
      const finishReason = (finalResult as any).finishReason;

      // Yield final chunk with metadata
      yield {
        text: '',
        isComplete: true,
        toolCalls:
          toolCallsAccumulator.size > 0
            ? Array.from(toolCallsAccumulator.entries()).map(([id, { name, args }]) => {
              // 调试日志：检查工具调用参数
              logger.debug('流式工具调用', {
                id,
                name,
                args,
                argsLength: args?.length || 0,
              });
              return {
                id,
                name,
                arguments: args || '{}',
              };
            })
            : undefined,
        usage: {
          promptTokens: usage?.promptTokens ?? 0,
          completionTokens: usage?.completionTokens ?? 0,
          totalTokens: usage?.totalTokens ?? 0,
        },
        finishReason: this.mapFinishReason(finishReason),
      };
    } catch (error) {
      // step5. 增强错误处理，添加更多上下文
      if (error instanceof Error) {
        // 记录原始错误用于调试（生产环境中应该使用日志系统）
        const enhancedError = new Error(`Zhipu AI streaming failed: ${error.message}`);
        (enhancedError as any).cause = error;
        (enhancedError as any).requestContext = {
          model: request.model,
          messagesCount: request.messages.length,
          hasTools: !!request.tools,
        };
        throw enhancedError;
      }
      throw new Error('Zhipu AI streaming failed with unknown error');
    }
  }

  /**
   * Count tokens in a text string
   * Uses TokenCounter for estimation
   * @param text - Text to count tokens for
   * @returns Estimated token count
   */
  countTokens(text: string): number {
    return this.tokenCounter.countText(text);
  }

  /**
   * Count tokens in an array of messages
   * Uses TokenCounter for estimation
   * @param messages - Messages to count tokens for
   * @returns Estimated token count
   */
  countMessagesTokens(messages: ChatMessage[]): number {
    const result = this.tokenCounter.countMessages(messages);
    return result.total;
  }

  /**
   * Perform a health check on the provider
   * @returns Promise resolving to health check result
   */
  async healthCheck(): Promise<HealthCheckResult> {
    const startTime = Date.now();

    try {
      // Try a minimal completion request
      const testRequest: ModelCompleteRequest = {
        messages: [
          {
            role: 'user' as any,
            content: 'ping',
          },
        ],
        model: this.config.model || 'glm-4.7',
        maxTokens: 5,
      };

      await this.complete(testRequest);

      return {
        healthy: true,
        message: 'Zhipu AI provider is healthy',
        latency: Date.now() - startTime,
      };
    } catch (error) {
      return {
        healthy: false,
        message: 'Zhipu AI provider health check failed',
        latency: Date.now() - startTime,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Validate the provider configuration
   * @returns True if configuration is valid
   */
  validateConfig(): boolean {
    if (!this.config.apiKey || typeof this.config.apiKey !== 'string' || this.config.apiKey.trim().length === 0) {
      return false;
    }

    if (this.config.baseURL && typeof this.config.baseURL !== 'string') {
      return false;
    }

    if (this.config.model && typeof this.config.model !== 'string') {
      return false;
    }

    if (
      this.config.timeout !== undefined &&
      (typeof this.config.timeout !== 'number' || this.config.timeout <= 0)
    ) {
      return false;
    }

    if (
      this.config.maxRetries !== undefined &&
      (typeof this.config.maxRetries !== 'number' ||
        this.config.maxRetries < 0 ||
        !Number.isInteger(this.config.maxRetries))
    ) {
      return false;
    }

    return true;
  }

  /**
   * Convert domain messages to AI SDK format (CoreMessage)
   * @param messages - Domain chat messages
   * @returns AI SDK compatible messages (CoreMessage or UIMessage)
   */
  private convertMessagesToAISDK(messages: ChatMessage[]): Array<any> {
    return messages.map((msg) => {
      // step1. 处理带工具调用的 assistant 消息
      if (msg.role === 'assistant' && msg.toolCalls && msg.toolCalls.length > 0) {
        return {
          role: msg.role,
          content: msg.toolCalls.map((tc) => ({
            type: 'tool-call',
            toolCallId: tc.id,
            toolName: tc.name,
            // 优先使用预解析的 args 对象，否则从 arguments 字符串解析
            args: tc.args ?? (typeof tc.arguments === 'string' ? JSON.parse(tc.arguments) : tc.arguments),
          })),
        };
      }

      // step2. 处理工具结果消息
      if (msg.role === 'tool') {
        return {
          role: msg.role,
          content: [
            {
              type: 'tool-result',
              toolCallId: msg.toolCallId || '',
              toolName: (msg.metadata?.toolName as string) || '',
              result: msg.content,
            },
          ],
          // tool 消息需要指定 toolCallId
          ...(msg.toolCallId && { toolCallId: msg.toolCallId }),
        };
      }

      // step3. 处理普通文本消息（user, system, assistant without tool calls）
      return {
        role: msg.role,
        content: msg.content,
      };
    });
  }

  /**
   * Convert tool definitions to AI SDK format
   * Vercel AI SDK 期望工具定义是一个对象映射（key 是工具名称），而不是数组
   * @param tools - Domain tool definitions
   * @returns AI SDK compatible tool definitions (object format)
   */
  private convertToolsToAISDK(tools: ModelCompleteRequest['tools']): Record<string, {
    description: string;
    parameters: z.ZodType<any, any>;
  }> {
    if (!tools) {
      return {};
    }

    const toolsMap: Record<string, {
      description: string;
      parameters: z.ZodType<any, any>;
    }> = {};

    for (const tool of tools) {
      toolsMap[tool.name] = {
        description: tool.description,
        // 将参数 schema 转换为 Zod schema
        parameters: this.convertParametersToZod(tool.parameters ?? {}),
      };
    }

    return toolsMap;
  }

  /**
   * Convert parameters object to Zod schema
   * @param parameters - Parameters object (may be JSON Schema or plain object)
   * @returns Zod schema
   */
  private convertParametersToZod(parameters: Record<string, unknown>): z.ZodType<any, any> {
    // 如果已经是 Zod schema，直接返回
    if (parameters && typeof parameters === 'object' && 'safeParse' in parameters && typeof parameters.safeParse === 'function') {
      return parameters as unknown as z.ZodType<any, any>;
    }

    // 否则创建一个基本的 Zod object schema
    // 这是一个简化的实现，实际应该根据 JSON Schema 创建对应的 Zod schema
    try {
      // 尝试从 JSON Schema 创建 Zod schema
      const schema: Record<string, z.ZodTypeAny> = {};

      // 获取 required 字段列表
      const requiredFields = Array.isArray(parameters.required)
        ? new Set(parameters.required as string[])
        : new Set<string>();

      if (parameters.properties && typeof parameters.properties === 'object') {
        for (const [key, value] of Object.entries(parameters.properties as Record<string, any>)) {
          const propSchema = (value as any).type || 'string';
          let zodType: z.ZodTypeAny;

          switch (propSchema) {
            case 'string':
              zodType = z.string();
              break;
            case 'number':
              zodType = z.number();
              break;
            case 'boolean':
              zodType = z.boolean();
              break;
            case 'array':
              zodType = z.array(z.any());
              break;
            case 'object':
              zodType = z.object({}).passthrough();
              break;
            default:
              zodType = z.any();
          }

          // 如果字段不在 required 列表中，设为可选
          if (!requiredFields.has(key)) {
            zodType = zodType.optional();
          }

          schema[key] = zodType;
        }
      }

      return z.object(schema);
    } catch {
      // 如果转换失败，返回一个接受任何值的 schema
      return z.object({}).passthrough();
    }
  }

  /**
   * Map AI SDK finish reason to domain finish reason
   * @param finishReason - AI SDK finish reason
   * @returns Domain finish reason
   */
  private mapFinishReason(
    finishReason: string | undefined | null,
  ): ModelCompleteResponse['finishReason'] {
    switch (finishReason) {
      case 'stop':
        return 'stop';
      case 'length':
        return 'length';
      case 'tool-calls':
        return 'tool_calls';
      case 'content-filter':
        return 'content_filter';
      default:
        return 'stop';
    }
  }
}
