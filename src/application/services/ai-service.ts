/**
 * @fileoverview AI Service - Application layer service for AI agent operations
 * @module application/services/ai-service
 */

import { EventEmitter } from 'events';
import { v4 as uuidv4 } from 'uuid';

import type { AgentOrchestrator } from '../../domain/agent/orchestrator.js';
import type { IContextManager } from '../../domain/context/interface.js';
import type { HookEvent } from '../../domain/hooks/types.js';
import type { ToolCall, ToolResult, TokenUsage } from '../../domain/agent/types.js';

import type {
  SendMessageDto,
  SendMessageResponseDto,
  ClearHistoryDto,
  ClearHistoryResponseDto,
  ServiceStatus,
  ServiceStatusInfo,
  ResponseToolCall,
  ResponseToolResult,
  ResponseTokenUsage,
} from '../dto/chat.dto.js';

/**
 * AI Service - Application layer service for managing AI agent operations
 *
 * This service acts as a facade between the application layer (controllers)
 * and the domain layer (AgentOrchestrator). It handles:
 * - Message processing through the agent
 * - Session and history management
 * - Event forwarding to registered listeners
 * - Service status tracking
 */
export class AIService extends EventEmitter {
  private orchestrator: AgentOrchestrator | null = null;
  private contextManager: IContextManager | null = null;
  private status: ServiceStatus = 'initializing' as ServiceStatus;
  private currentSessionId: string | null = null;
  private lastActivity: Date | null = null;
  private eventForwardingSetup = false;

  /**
   * Initialize the AI service with domain components
   *
   * @param orchestrator - The agent orchestrator instance
   * @param contextManager - The context manager instance
   */
  initialize(
    orchestrator: AgentOrchestrator,
    contextManager: IContextManager
  ): void {
    if (this.status === 'processing') {
      throw new Error('Cannot initialize service while processing');
    }

    this.orchestrator = orchestrator;
    this.contextManager = contextManager;
    this.currentSessionId = orchestrator.getSessionId();
    this.status = 'idle' as ServiceStatus;

    // Setup event forwarding from orchestrator to service listeners
    this.setupEventForwarding();

    // Emit initialization event
    this.emit('initialized', {
      sessionId: this.currentSessionId,
      timestamp: new Date(),
    });
  }

  /**
   * Send a message to the AI agent and get a response
   *
   * @param dto - The send message DTO
   * @returns Promise resolving to the agent's response
   */
  async sendMessage(dto: SendMessageDto): Promise<SendMessageResponseDto> {
    if (!this.orchestrator) {
      throw new Error('AI Service not initialized. Call initialize() first.');
    }

    if (this.status === 'processing') {
      throw new Error('Service is already processing a request');
    }

    this.status = 'processing' as ServiceStatus;
    this.lastActivity = new Date();

    const startTime = Date.now();

    try {
      // Emit before message event
      this.emit('beforeMessage', {
        message: dto.message,
        sessionId: this.currentSessionId || dto.sessionId,
        timestamp: new Date(),
      });

      // Process the user input through the orchestrator
      const result = await this.orchestrator.processUserInput(dto.message);

      // Build response DTO
      const response: SendMessageResponseDto = {
        response: result.response,
        sessionId: this.currentSessionId || '',
        iterations: result.iterations,
        toolCalls: result.toolCalls.map(this.mapToolCallToResponse),
        toolResults: result.toolResults.map(this.mapToolResultToResponse),
        tokenUsage: this.mapTokenUsageToResponse(result.tokenUsage),
        success: result.success,
        timestamp: new Date().toISOString(),
      };

      if (result.error) {
        response.error = result.error.message;
      }

      this.status = 'idle' as ServiceStatus;
      this.lastActivity = new Date();

      // Emit after message event
      this.emit('afterMessage', {
        response,
        duration: Date.now() - startTime,
        timestamp: new Date(),
      });

      return response;
    } catch (error) {
      this.status = 'error' as ServiceStatus;
      const err = error instanceof Error ? error : new Error(String(error));

      // Emit error event
      this.emit('messageError', {
        error: err,
        message: dto.message,
        timestamp: new Date(),
      });

      // Return error response
      return {
        response: '',
        sessionId: this.currentSessionId || '',
        iterations: 0,
        toolCalls: [],
        toolResults: [],
        tokenUsage: {
          promptTokens: 0,
          completionTokens: 0,
          totalTokens: 0,
        },
        success: false,
        error: err.message,
        timestamp: new Date().toISOString(),
      };
    }
  }

  /**
   * Clear the conversation history
   *
   * @param dto - The clear history DTO
   * @returns Promise resolving to the clear history response
   */
  async clearHistory(dto: ClearHistoryDto = {}): Promise<ClearHistoryResponseDto> {
    if (!this.contextManager) {
      throw new Error('AI Service not initialized. Call initialize() first.');
    }

    if (this.status === 'processing') {
      throw new Error('Cannot clear history while processing');
    }

    const sessionId = dto.sessionId || this.currentSessionId || '';
    const messagesBefore = this.contextManager.getMessages();

    try {
      // Clear messages
      this.contextManager.clear();

      // If not clearing system prompt, re-add it
      if (!dto.clearSystemPrompt && this.orchestrator) {
        const systemPrompt = this.orchestrator.getSystemPrompt();
        const { MessageRole } = await import('../../domain/agent/types.js');
        const systemMessage = {
          role: MessageRole.SYSTEM,
          content: systemPrompt,
          metadata: {
            sessionId,
            timestamp: new Date().toISOString(),
          },
        };
        this.contextManager.addMessage(systemMessage as any);
      }

      const messagesCleared = messagesBefore.length;

      // Emit history cleared event
      this.emit('historyCleared', {
        sessionId,
        messagesCleared,
        timestamp: new Date(),
      });

      return {
        success: true,
        sessionId,
        messagesCleared,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));

      // Emit error event
      this.emit('clearHistoryError', {
        error: err,
        sessionId,
        timestamp: new Date(),
      });

      throw err;
    }
  }

  /**
   * Get the current service status
   *
   * @returns The current service status information
   */
  getStatus(): ServiceStatusInfo {
    const statusInfo: ServiceStatusInfo = {
      status: this.status,
      sessionId: this.currentSessionId || undefined,
      lastActivity: this.lastActivity?.toISOString(),
    };

    // Add model info if available
    if (this.orchestrator) {
      const config = this.orchestrator.getConfig();
      statusInfo.model = config.model;
      statusInfo.streamingEnabled = config.stream;
    }

    // Add context stats if available
    if (this.contextManager) {
      const stats = this.contextManager.getStats();
      statusInfo.messageCount = stats.messageCount;
      // Note: ContextStats doesn't have totalTokens, using estimatedTokens instead
      statusInfo.totalTokens = stats.estimatedTokens;
    }

    // Add error if status is error
    if (this.status === 'error') {
      const processingState = this.orchestrator?.getProcessingState();
      statusInfo.error = processingState?.lastError?.message;
    }

    return statusInfo;
  }

  /**
   * Get the current session ID
   *
   * @returns The current session ID or null if not initialized
   */
  getSessionId(): string | null {
    return this.currentSessionId;
  }

  /**
   * Get the context manager instance
   *
   * @returns The context manager or null if not initialized
   */
  getContext(): IContextManager | null {
    return this.contextManager;
  }

  /**
   * Get the orchestrator instance
   *
   * @returns The orchestrator or null if not initialized
   */
  getOrchestrator(): AgentOrchestrator | null {
    return this.orchestrator;
  }

  /**
   * Check if the service is ready to process requests
   *
   * @returns True if service is initialized and idle
   */
  isReady(): boolean {
    return this.status === 'idle' && this.orchestrator !== null;
  }

  /**
   * Check if the service is currently processing
   *
   * @returns True if service is processing
   */
  isProcessing(): boolean {
    return this.status === 'processing';
  }

  /**
   * Shutdown the service
   */
  shutdown(): void {
    this.status = 'shutting_down' as ServiceStatus;

    // Remove all event forwarding
    if (this.orchestrator && this.eventForwardingSetup) {
      this.orchestrator.removeAllListeners();
      this.eventForwardingSetup = false;
    }

    // Clear references
    this.orchestrator = null;
    this.contextManager = null;
    this.currentSessionId = null;

    this.status = 'stopped' as ServiceStatus;

    // Emit shutdown event
    this.emit('shutdown', {
      timestamp: new Date(),
    });

    // Remove all listeners
    this.removeAllListeners();
  }

  /**
   * Setup event forwarding from the orchestrator to service listeners
   */
  private setupEventForwarding(): void {
    if (!this.orchestrator || this.eventForwardingSetup) {
      return;
    }

    // Forward hook events from orchestrator to service
    const hookEvents: HookEvent[] = [
      'start' as HookEvent,
      'thinking' as HookEvent,
      'beforeTool' as HookEvent,
      'afterTool' as HookEvent,
      'toolError' as HookEvent,
      'complete' as HookEvent,
      'error' as HookEvent,
      'beforeSend' as HookEvent,
      'afterReceive' as HookEvent,
      'securityCheck' as HookEvent,
    ];

    for (const event of hookEvents) {
      this.orchestrator.on(event as any, (data: any) => {
        this.emit('hook', {
          event,
          data,
          timestamp: new Date(),
        });
      });
    }

    this.eventForwardingSetup = true;
  }

  /**
   * Map a domain ToolCall to a ResponseToolCall DTO
   */
  private mapToolCallToResponse(toolCall: ToolCall): ResponseToolCall {
    return {
      id: toolCall.id,
      name: toolCall.name,
      arguments: toolCall.arguments,
      args: toolCall.args,
    };
  }

  /**
   * Map a domain ToolResult to a ResponseToolResult DTO
   */
  private mapToolResultToResponse(toolResult: ToolResult): ResponseToolResult {
    return {
      toolCallId: toolResult.toolCallId,
      toolName: toolResult.toolName,
      success: toolResult.success,
      output: toolResult.output,
      error: toolResult.error,
      duration: toolResult.duration,
    };
  }

  /**
   * Map a domain TokenUsage to a ResponseTokenUsage DTO
   */
  private mapTokenUsageToResponse(tokenUsage: TokenUsage): ResponseTokenUsage {
    return {
      promptTokens: tokenUsage.promptTokens,
      completionTokens: tokenUsage.completionTokens,
      totalTokens: tokenUsage.totalTokens,
    };
  }
}
