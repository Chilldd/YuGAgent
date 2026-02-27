/**
 * @fileoverview Dependency Injection Container for YuGAgent
 * @module di/container
 */

import type { AgentConfig } from '../domain/agent/types.js';

// Infrastructure Layer
import { ZhipuModelProvider } from '../infrastructure/model-provider/zhipu/adapter.js';
import { getZhipuConfig } from '../infrastructure/model-provider/zhipu/config.js';
import { ToolExecutor } from '../infrastructure/tool-executor/executor.js';

// Domain Layer
import { AgentOrchestrator } from '../domain/agent/orchestrator.js';
import { ContextManager } from '../domain/context/manager.js';
import { MemoryManager } from '../domain/memory/manager.js';
import { HooksManager } from '../domain/hooks/manager.js';

// Application Layer
import { AIService } from '../application/services/ai-service.js';
import { ChatController } from '../application/interfaces/controllers/chat.controller.js';

/**
 * Application container with all initialized dependencies
 */
export interface AppContainer {
  /** Agent orchestrator instance */
  agent: AgentOrchestrator;
  /** AI service instance */
  aiService: AIService;
  /** Chat controller instance */
  chatController: ChatController;
  /** Model provider instance */
  modelProvider: ZhipuModelProvider;
}

/**
 * Configuration options for createApp
 */
export interface CreateAppOptions {
  /** Agent configuration */
  agentConfig?: Partial<AgentConfig>;
  /** Allowed tools for this session */
  allowedTools?: string[];
  /** Maximum thought iterations */
  maxThoughtIterations?: number;
  /** Custom system prompt */
  systemPrompt?: string;
}

/**
 * Default agent configuration (minimal - API key comes from model provider)
 */
const DEFAULT_AGENT_CONFIG: AgentConfig = {
  apiKey: '', // Will be provided by model provider
  model: 'glm-4.7',
  temperature: 0.7,
  maxTokens: 4096,
  stream: false,
  topP: 0.9,
};

/**
 * Default allowed tools
 */
const DEFAULT_ALLOWED_TOOLS = [
  'terminal',
  'file-read',
  'directory-list',
] as const;

/**
 * Create and initialize the YuGAgent application with all dependencies
 *
 * Creates dependencies in order:
 * 1. Infrastructure Layer (Model Provider, Tool Executor)
 * 2. Domain Layer (Memory, Context, Hooks, Agent)
 * 3. Application Layer (AI Service, Chat Controller)
 *
 * @param options - Application creation options
 * @returns Initialized application container
 * @throws Error if ZHIPU_API_KEY environment variable is not set
 *
 * @example
 * ```typescript
 * const { agent, aiService, chatController, modelProvider } = createApp();
 *
 * // Use the chat controller for interactions
 * const response = await chatController.sendMessage({
 *   message: 'Hello, YuGAgent!'
 * });
 * ```
 */
export function createApp(options: CreateAppOptions = {}): AppContainer {
  // ============================================================
  // 1. Infrastructure Layer
  // ============================================================

  // Create model provider with configuration from environment
  const zhipuConfig = getZhipuConfig();
  const modelProvider = new ZhipuModelProvider(zhipuConfig);

  // Merge agent config with defaults and API key from model provider
  const agentConfig: AgentConfig = {
    ...DEFAULT_AGENT_CONFIG,
    apiKey: zhipuConfig.apiKey,
    ...options.agentConfig,
  };

  // Create tool executor with built-in security rules
  const toolExecutor = new ToolExecutor({
    enableBuiltInSecurity: true,
    maxTimeout: 120000,
    enableLogging: false,
  });

  // ============================================================
  // 2. Domain Layer
  // ============================================================

  // Create memory manager (no constructor params)
  const memoryManager = new MemoryManager();

  // Create context manager with memory integration
  const contextManager = new ContextManager(memoryManager, {
    maxMessages: 100,
    maxTokens: 8000,
    truncationStrategy: 'oldest',
  });

  // Create hooks manager (no constructor params)
  const hooksManager = new HooksManager();

  // Create agent orchestrator with all dependencies
  const allowedTools = options.allowedTools || [...DEFAULT_ALLOWED_TOOLS];
  const agent = new AgentOrchestrator(
    modelProvider,
    contextManager,
    memoryManager,
    hooksManager,
    toolExecutor,
    {
      config: agentConfig,
      systemPrompt: options.systemPrompt,
      allowedTools,
      maxThoughtIterations: options.maxThoughtIterations,
    }
  );

  // ============================================================
  // 3. Application Layer
  // ============================================================

  // Create AI service and initialize with domain components
  const aiService = new AIService();
  aiService.initialize(agent, contextManager);

  // Create chat controller with AI service
  const chatController = new ChatController(aiService);

  return {
    agent,
    aiService,
    chatController,
    modelProvider,
  };
}

/**
 * Create app with custom Zhipu configuration
 * Useful for testing or when environment variables are not available
 *
 * @param apiKey - Zhipu AI API key
 * @param options - Additional application options
 * @returns Initialized application container
 */
export function createAppWithApiKey(
  apiKey: string,
  options: Omit<CreateAppOptions, 'agentConfig'> & { agentConfig?: Partial<AgentConfig> } = {}
): AppContainer {
  // Temporarily set environment variable for getZhipuConfig
  const originalApiKey = process.env.ZHIPU_API_KEY;
  process.env.ZHIPU_API_KEY = apiKey;

  try {
    return createApp(options);
  } finally {
    // Restore original environment variable
    if (originalApiKey !== undefined) {
      process.env.ZHIPU_API_KEY = originalApiKey;
    } else {
      delete process.env.ZHIPU_API_KEY;
    }
  }
}

/**
 * Shutdown and cleanup application resources
 *
 * @param container - Application container to shutdown
 */
export function shutdownApp(container: AppContainer): void {
  container.chatController.shutdown();
}
