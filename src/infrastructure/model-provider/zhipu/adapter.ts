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
        generationParams.tools = this.convertToolsToAISDK(request.tools);
      }
      if (request.toolChoice) {
        generationParams.toolChoice = request.toolChoice;
      }
      if (request.headers) {
        generationParams.headers = request.headers;
      }

      // step5. 使用 AI SDK 生成文本
      const result = await generateText(generationParams);

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
        response.toolCalls = result.toolCalls.map((tc) => ({
          id: tc.toolCallId,
          name: tc.toolName,
          arguments: tc.args as string,
        }));
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
      if (msg.content === undefined || typeof msg.content !== 'string') {
        throw new Error(`Message at index ${i} missing valid content`);
      }
      if (msg.content.length > 100000) {
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

      // Yield text chunks
      for await (const chunk of result.textStream) {
        fullText += chunk;
        yield {
          text: chunk,
          isComplete: false,
        };
      }

      // Wait for completion to get final metadata
      const finalResult = await result;

      // Collect tool calls if any
      const toolCalls = (finalResult as any).toolCalls;
      if (toolCalls && toolCalls.length > 0) {
        for (const tc of toolCalls) {
          toolCallsAccumulator.set(tc.toolCallId, {
            name: tc.toolName,
            args: tc.args as string,
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
            ? Array.from(toolCallsAccumulator.entries()).map(([id, { name, args }]) => ({
                id,
                name,
                arguments: args,
              }))
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
   * Convert domain messages to AI SDK format
   * @param messages - Domain chat messages
   * @returns AI SDK compatible messages
   */
  private convertMessagesToAISDK(messages: ChatMessage[]): Array<{ role: string; content: string }> {
    return messages.map((msg) => ({
      role: msg.role,
      content: msg.content,
    }));
  }

  /**
   * Convert tool definitions to AI SDK format
   * @param tools - Domain tool definitions
   * @returns AI SDK compatible tool definitions
   */
  private convertToolsToAISDK(tools: ModelCompleteRequest['tools']): Array<{
    type: string;
    name: string;
    description: string;
    parameters: z.ZodType<any, any>;
  }> {
    if (!tools) {
      return [];
    }

    return tools.map((tool) => ({
      type: 'function',
      name: tool.name,
      description: tool.description,
      // 将参数 schema 转换为 Zod schema
      parameters: this.convertParametersToZod(tool.parameters ?? {}),
    }));
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

      if (parameters.properties && typeof parameters.properties === 'object') {
        for (const [key, value] of Object.entries(parameters.properties as Record<string, any>)) {
          const propSchema = (value as any).type || 'string';
          switch (propSchema) {
            case 'string':
              schema[key] = z.string();
              break;
            case 'number':
              schema[key] = z.number();
              break;
            case 'boolean':
              schema[key] = z.boolean();
              break;
            case 'array':
              schema[key] = z.array(z.any());
              break;
            default:
              schema[key] = z.any();
          }
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
