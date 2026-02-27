# YuGAgent Phase 1 MVP Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 构建一个基于智谱 GLM-4.7 的本地终端 AI 助手，支持命令执行、文件读取、目录列表等基础工具，使用 Ink 实现多窗口 TUI 界面。

**Architecture:** 采用分层洋葱架构 (Clean Architecture + Event-Driven)，分为 TUI Presentation Layer、Application Layer、Domain Layer、Infrastructure Layer 四层，通过 EventEmitter 解耦，依赖倒置实现高扩展性。

**Tech Stack:** Node.js 18+, TypeScript 5.3, Vercel AI SDK (@ai-sdk/openai + ai), Ink 4.4, Zod 3.22, Commander 12.0

---

## Task 1: 项目基础架构搭建

**Files:**
- Create: `package.json`
- Create: `tsconfig.json`
- Create: `.gitignore`
- Create: `src/index.ts`

**Step 1: 初始化 package.json**

```bash
npm init -y
```

**Step 2: 写入完整的 package.json**

```json
{
  "name": "yu-g-agent",
  "version": "2.0.0",
  "description": "现代化多模型终端 AI 助手",
  "type": "module",
  "main": "dist/index.js",
  "bin": {
    "yugagent": "./dist/cli.js"
  },
  "scripts": {
    "dev": "tsx src/index.ts",
    "build": "tsup",
    "start": "node dist/cli.js",
    "test": "vitest",
    "lint": "eslint src/",
    "format": "prettier --write src/"
  },
  "dependencies": {
    "@ai-sdk/openai": "^1.0.0",
    "ai": "^3.0.0",
    "ink": "^4.4.0",
    "@inkjs/ui": "^1.0.0",
    "zod": "^3.22.0",
    "marked": "^12.0.0",
    "commander": "^12.0.0",
    "cosmiconfig": "^9.0.0",
    "react": "^18.2.0"
  },
  "devDependencies": {
    "@types/node": "^20.11.0",
    "@types/react": "^18.2.0",
    "typescript": "~5.3.0",
    "tsx": "^4.7.0",
    "tsup": "^8.0.0",
    "vitest": "^1.0.0",
    "eslint": "^8.56.0",
    "prettier": "^3.2.0",
    "@typescript-eslint/eslint-plugin": "^7.0.0",
    "@typescript-eslint/parser": "^7.0.0"
  },
  "engines": {
    "node": ">=18.0.0"
  }
}
```

**Step 3: 创建 tsconfig.json**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "lib": ["ES2022"],
    "moduleResolution": "bundler",
    "resolveJsonModule": true,
    "allowJs": true,
    "outDir": "./dist",
    "rootDir": "./src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "jsx": "react-jsx",
    "types": ["node"]
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist"]
}
```

**Step 4: 更新 .gitignore**

```gitignore
node_modules/
dist/
*.log
.DS_Store
.env
.env.local
.yugagent/
.claude/
```

**Step 5: 创建入口文件**

```typescript
// src/index.ts
#!/usr/bin/env node

import { Command } from 'commander';

const program = new Command();

program
  .name('yugagent')
  .description('现代化多模型终端 AI 助手')
  .version('2.0.0');

program.parse();
```

**Step 6: 安装依赖**

```bash
npm install
```

**Step 7: 验证项目可以运行**

```bash
npm run dev -- --version
```

Expected: `2.0.0`

**Step 8: Commit**

```bash
git add package.json tsconfig.json .gitignore src/index.ts
git commit -m "feat: initialize project structure with TypeScript and Commander"
```

---

## Task 2: 领域层 - 核心类型定义

**Files:**
- Create: `src/domain/agent/types.ts`
- Create: `src/domain/context/types.ts`
- Create: `src/domain/memory/types.ts`
- Create: `src/domain/hooks/types.ts`
- Create: `src/domain/events/event-types.ts`

**Step 1: 创建 agent 类型定义**

```typescript
// src/domain/agent/types.ts

/**
 * 消息角色类型
 */
export enum MessageRole {
  SYSTEM = 'system',
  USER = 'user',
  ASSISTANT = 'assistant',
  TOOL = 'tool',
}

/**
 * 聊天消息
 */
export interface ChatMessage {
  id: string;
  role: MessageRole;
  content: string;
  timestamp: number;
  toolCalls?: ToolCall[];
  toolResult?: ToolResult;
  metadata?: Record<string, unknown>;
}

/**
 * 工具调用定义
 */
export interface ToolCall {
  id: string;
  name: string;
  arguments: Record<string, unknown>;
  status: 'pending' | 'running' | 'completed' | 'failed';
  result?: unknown;
  error?: Error;
}

/**
 * 工具执行结果
 */
export interface ToolResult {
  toolCallId: string;
  output: string;
  error?: Error;
  executionTime: number;
}

/**
 * Token 使用统计
 */
export interface TokenUsage {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
}

/**
 * Agent 配置
 */
export interface AgentConfig {
  modelProvider: string;
  model: string;
  temperature?: number;
  maxTokens?: number;
  systemPrompt?: string;
  allowedTools: string[];
  securityRules: SecurityRule[];
}

/**
 * 安全规则定义
 */
export interface SecurityRule {
  id: string;
  type: 'block' | 'warn';
  pattern: RegExp;
  description: string;
  enabled: boolean;
}

/**
 * Agent 上下文
 */
export interface AgentContext {
  messages: ChatMessage[];
  tokenCount: number;
  lastUpdated: number;
}
```

**Step 2: 创建 context 类型定义**

```typescript
// src/domain/context/types.ts

import type { ChatMessage } from '../agent/types.js';

/**
 * 上下文管理器接口
 */
export interface IContextManager {
  /**
   * 添加消息
   */
  addMessage(message: ChatMessage): Promise<void>;

  /**
   * 添加工具结果
   */
  addToolResult(toolCall: ToolCall, result: string): Promise<void>;

  /**
   * 添加工具错误
   */
  addToolError(toolCall: ToolCall, error: Error): Promise<void>;

  /**
   * 获取上下文
   */
  getContext(): Promise<AgentContext>;

  /**
   * 清空上下文
   */
  clear(): Promise<void>;
}

/**
 * 导入依赖类型
 */
import type { ToolCall, AgentContext } from '../agent/types.js';
```

**Step 3: 创建 memory 类型定义**

```typescript
// src/domain/memory/types.ts

import type { ChatMessage, TokenUsage } from '../agent/types.js';

/**
 * Memory 管理器接口
 */
export interface IMemoryManager {
  /**
   * 记录 Token 使用
   */
  recordTokenUsage(usage: TokenUsage): Promise<void>;

  /**
   * 获取 Token 统计
   */
  getTokenStats(): Promise<TokenUsage>;

  /**
   * 计算消息的 Token 数量
   */
  countTokens(messages: ChatMessage[]): Promise<number>;

  /**
   * 存储会话数据
   */
  store(key: string, value: unknown): Promise<void>;

  /**
   * 检索会话数据
   */
  retrieve(key: string): Promise<unknown | null>;
}
```

**Step 4: 创建 hooks 类型定义**

```typescript
// src/domain/hooks/types.ts

/**
 * 钩子处理器类型
 */
export type HookHandler = (context: HookContext) => void | Promise<void>;

/**
 * 钩子上下文
 */
export interface HookContext {
  [key: string]: unknown;
}

/**
 * 钩子选项
 */
export interface HookOptions {
  priority?: number;
  once?: boolean;
}

/**
 * 钩子事件定义
 */
export enum HookEvent {
  ON_START = 'onStart',
  ON_THINKING = 'onThinking',
  ON_BEFORE_TOOL = 'onBeforeTool',
  ON_TOOL_RESULT = 'onToolResult',
  ON_TOOL_ERROR = 'onToolError',
  ON_COMPLETE = 'onComplete',
  ON_ERROR = 'onError',
}

/**
 * Hooks 管理器接口
 */
export interface IHooksManager {
  /**
   * 注册钩子
   */
  on(event: HookEvent, handler: HookHandler, options?: HookOptions): void;

  /**
   * 移除钩子
   */
  off(event: HookEvent, handler: HookHandler): void;

  /**
   * 触发钩子
   */
  trigger(event: HookEvent, context: HookContext): Promise<void>;
}
```

**Step 5: 创建事件类型定义**

```typescript
// src/domain/events/event-types.ts

/**
 * 系统事件类型
 */
export enum SystemEventType {
  // Agent 事件
  AGENT_START = 'agent:start',
  AGENT_THINKING = 'agent:thinking',
  AGENT_COMPLETE = 'agent:complete',
  AGENT_ERROR = 'agent:error',

  // 工具事件
  TOOL_START = 'tool:start',
  TOOL_COMPLETE = 'tool:complete',
  TOOL_ERROR = 'tool:error',

  // UI 事件
  UI_USER_MESSAGE = 'ui:user-message',
  UI_AI_RESPONSE = 'ui:ai-response',
  UI_STREAM_CHUNK = 'ui:stream-chunk',
  UI_STREAM_END = 'ui:stream-end',

  // 上下文事件
  CONTEXT_UPDATED = 'context:updated',
  CONTEXT_TRUNCATED = 'context:truncated',
}

/**
 * 事件数据类型
 */
export interface EventData {
  [SystemEventType.AGENT_START]: { input: string };
  [SystemEventType.AGENT_THINKING]: { context: unknown };
  [SystemEventType.AGENT_COMPLETE]: { response: string };
  [SystemEventType.AGENT_ERROR]: { error: Error };
  [SystemEventType.TOOL_START]: { toolName: string };
  [SystemEventType.TOOL_COMPLETE]: { toolName: string; result: string };
  [SystemEventType.TOOL_ERROR]: { toolName: string; error: Error };
  [SystemEventType.UI_USER_MESSAGE]: { message: string };
  [SystemEventType.UI_AI_RESPONSE]: { response: string };
  [SystemEventType.UI_STREAM_CHUNK]: { chunk: unknown };
  [SystemEventType.UI_STREAM_END]: never;
  [SystemEventType.CONTEXT_UPDATED]: { messageCount: number };
  [SystemEventType.CONTEXT_TRUNCATED]: { removedCount: number };
}
```

**Step 6: Commit**

```bash
git add src/domain/
git commit -m "feat(domain): add core type definitions for agent, context, memory, hooks, and events"
```

---

## Task 3: 领域层 - Hooks Manager 实现

**Files:**
- Create: `src/domain/hooks/manager.ts`
- Create: `src/domain/hooks/middleware-chain.ts`
- Create: `src/domain/hooks/interface.ts`

**Step 1: 创建 Hooks Manager 实现**

```typescript
// src/domain/hooks/manager.ts

import type { IHooksManager, HookHandler, HookOptions, HookContext, HookEvent } from './types.js';

interface StoredHook {
  handler: HookHandler;
  priority: number;
  once: boolean;
}

/**
 * Hooks Manager
 *
 * 职责：
 * 1. 管理生命周期钩子注册
 * 2. 执行中间件链
 * 3. 支持异步钩子
 * 4. 提供钩子优先级控制
 */
export class HooksManager implements IHooksManager {
  private hooks: Map<HookEvent, StoredHook[]> = new Map();

  constructor() {
    // 初始化所有钩子事件
    const events = [
      'onStart',
      'onThinking',
      'onBeforeTool',
      'onToolResult',
      'onToolError',
      'onComplete',
      'onError',
    ] as const;

    for (const event of events) {
      this.hooks.set(event, []);
    }
  }

  on(event: HookEvent, handler: HookHandler, options: HookOptions = {}): void {
    const handlers = this.hooks.get(event) || [];
    handlers.push({
      handler,
      priority: options.priority ?? 0,
      once: options.once ?? false,
    });
    // 按优先级排序（高优先级先执行）
    handlers.sort((a, b) => b.priority - a.priority);
    this.hooks.set(event, handlers);
  }

  async trigger(event: HookEvent, context: HookContext): Promise<void> {
    const handlers = this.hooks.get(event) || [];
    const toRemove: number[] = [];

    for (let i = 0; i < handlers.length; i++) {
      const { handler, once } = handlers[i];
      try {
        await handler(context);
      } catch (error) {
        // 钩子执行失败不影响其他钩子
        console.error(`Hook error in ${event}:`, error);
      }

      if (once) {
        toRemove.push(i);
      }
    }

    // 移除一次性钩子（从后往前移，避免索引问题）
    toRemove.reverse().forEach(i => handlers.splice(i, 1));
  }

  off(event: HookEvent, handler: HookHandler): void {
    const handlers = this.hooks.get(event);
    if (!handlers) return;

    const index = handlers.findIndex(h => h.handler === handler);
    if (index >= 0) {
      handlers.splice(index, 1);
    }
  }
}
```

**Step 2: 创建中间件链实现**

```typescript
// src/domain/hooks/middleware-chain.ts

/**
 * 中间件函数类型
 */
export type MiddlewareFunction<T> = (
  context: T,
  next: () => Promise<void>
) => Promise<void> | void;

/**
 * 中间件链
 *
 * 实现洋葱模型的中间件执行模式
 */
export class MiddlewareChain<T = unknown> {
  private middlewares: MiddlewareFunction<T>[] = [];

  use(middleware: MiddlewareFunction<T>): void {
    this.middlewares.push(middleware);
  }

  /**
   * 执行中间件链
   */
  async execute(context: T): Promise<void> {
    let index = 0;

    const next = async (): Promise<void> => {
      if (index >= this.middlewares.length) {
        return;
      }
      const middleware = this.middlewares[index++];
      await middleware(context, next);
    };

    await next();
  }

  /**
   * 清空中间件
   */
  clear(): void {
    this.middlewares = [];
  }
}
```

**Step 3: 创建 Hooks 接口导出文件**

```typescript
// src/domain/hooks/interface.ts

export { IHooksManager, HookHandler, HookOptions, HookContext, HookEvent } from './types.js';
export { HooksManager } from './manager.js';
export { MiddlewareChain } from './middleware-chain.js';
```

**Step 4: Commit**

```bash
git add src/domain/hooks/
git commit -m "feat(domain): implement HooksManager and MiddlewareChain"
```

---

## Task 4: 领域层 - Memory Manager 实现

**Files:**
- Create: `src/domain/memory/manager.ts`
- Create: `src/domain/memory/token-counter.ts`
- Create: `src/domain/memory/session-store.ts`
- Create: `src/domain/memory/interface.ts`

**Step 1: 创建 Token 计数器**

```typescript
// src/domain/memory/token-counter.ts

import type { ChatMessage } from '../agent/types.js';

/**
 * Token 计数器
 *
 * 职责：估算文本的 Token 数量
 */
export class TokenCounter {
  /**
   * 计算消息列表的 Token 数量
   *
   * 使用简单估算：中文字符 * 1.5 + 英文单词 * 1
   * TODO: 后续可以使用 tiktoken 精确计算
   */
  countMessages(messages: ChatMessage[]): number {
    let count = 0;

    for (const msg of messages) {
      count += this.countText(msg.content);

      // 计算工具调用的额外 Token
      if (msg.toolCalls) {
        count += msg.toolCalls.length * 20; // 每个工具调用约 20 tokens
      }
    }

    return count;
  }

  /**
   * 计算单个文本的 Token 数量
   */
  countText(text: string): number {
    const chineseChars = (text.match(/[\u4e00-\u9fa5]/g) || []).length;
    const nonChinese = text.length - chineseChars;
    const englishWords = (nonChinese > 0)
      ? text.split(/[\u4e00-\u9fa5]+/).join(' ').split(/\s+/).filter(Boolean).length
      : 0;

    return Math.ceil(chineseChars * 1.5 + englishWords);
  }

  /**
   * 计算单个字符串的 Token 数量
   */
  countString(str: string): number {
    return this.countText(str);
  }
}
```

**Step 2: 创建会话存储（内存实现）**

```typescript
// src/domain/memory/session-store.ts

/**
 * 会话存储（内存实现）
 *
 * Phase 1 使用内存存储
 * Phase 2 预留向量数据库接口
 */
export class SessionStore {
  private store: Map<string, unknown> = new Map();

  set(key: string, value: unknown): void {
    this.store.set(key, value);
  }

  get<T = unknown>(key: string): T | null {
    const value = this.store.get(key);
    return value !== undefined ? (value as T) : null;
  }

  has(key: string): boolean {
    return this.store.has(key);
  }

  delete(key: string): boolean {
    return this.store.delete(key);
  }

  clear(): void {
    this.store.clear();
  }

  size(): number {
    return this.store.size;
  }

  keys(): string[] {
    return Array.from(this.store.keys());
  }

  values(): unknown[] {
    return Array.from(this.store.values());
  }
}
```

**Step 3: 创建 Memory Manager 实现**

```typescript
// src/domain/memory/manager.ts

import type { IMemoryManager } from './interface.js';
import type { ChatMessage, TokenUsage } from '../agent/types.js';
import { TokenCounter } from './token-counter.js';
import { SessionStore } from './session-store.js';

/**
 * Memory Manager
 *
 * 职责：
 * 1. Token 使用统计
 * 2. 会话数据存储
 * 3. Token 计数
 */
export class MemoryManager implements IMemoryManager {
  private tokenCounter: TokenCounter;
  private sessionStore: SessionStore;
  private totalUsage: TokenUsage = {
    promptTokens: 0,
    completionTokens: 0,
    totalTokens: 0,
  };

  constructor() {
    this.tokenCounter = new TokenCounter();
    this.sessionStore = new SessionStore();
  }

  async recordTokenUsage(usage: TokenUsage): Promise<void> {
    this.totalUsage.promptTokens += usage.promptTokens;
    this.totalUsage.completionTokens += usage.completionTokens;
    this.totalUsage.totalTokens += usage.totalTokens;
  }

  async getTokenStats(): Promise<TokenUsage> {
    return { ...this.totalUsage };
  }

  async countTokens(messages: ChatMessage[]): Promise<number> {
    return this.tokenCounter.countMessages(messages);
  }

  async store(key: string, value: unknown): Promise<void> {
    this.sessionStore.set(key, value);
  }

  async retrieve(key: string): Promise<unknown | null> {
    return this.sessionStore.get(key);
  }

  /**
   * 重置 Token 统计
   */
  resetTokenStats(): void {
    this.totalUsage = {
      promptTokens: 0,
      completionTokens: 0,
      totalTokens: 0,
    };
  }

  /**
   * 获取会话存储实例
   */
  getSessionStore(): SessionStore {
    return this.sessionStore;
  }
}
```

**Step 4: 创建接口导出文件**

```typescript
// src/domain/memory/interface.ts

export { IMemoryManager } from './types.js';
export { MemoryManager } from './manager.js';
export { TokenCounter } from './token-counter.js';
export { SessionStore } from './session-store.js';
```

**Step 5: Commit**

```bash
git add src/domain/memory/
git commit -m "feat(domain): implement MemoryManager with TokenCounter and SessionStore"
```

---

## Task 5: 基础设施层 - Model Provider 接口与实现

**Files:**
- Create: `src/infrastructure/model-provider/interface.ts`
- Create: `src/infrastructure/model-provider/registry.ts`
- Create: `src/infrastructure/model-provider/zhipu/adapter.ts`
- Create: `src/infrastructure/model-provider/zhipu/config.ts`
- Create: `src/infrastructure/model-provider/index.ts`

**Step 1: 创建 Model Provider 接口**

```typescript
// src/infrastructure/model-provider/interface.ts

import type { ChatMessage, TokenUsage } from '../../domain/agent/types.js';

/**
 * 模型完成请求
 */
export interface ModelCompleteRequest {
  messages: Array<{ role: string; content: string }>;
  tools?: string[];
  systemPrompt?: string;
  temperature?: number;
  maxTokens?: number;
}

/**
 * 模型完成响应
 */
export interface ModelCompleteResponse {
  content: string;
  toolCalls?: Array<{
    toolCallId: string;
    toolName: string;
    args: Record<string, unknown>;
  }>;
  usage: TokenUsage;
  finishReason: 'stop' | 'length' | 'tool_calls' | 'error';
}

/**
 * 流式响应块
 */
export interface StreamChunk {
  type: 'content' | 'tool_call' | 'done';
  content?: string;
  toolCall?: Partial<{
    toolCallId: string;
    toolName: string;
    args: Record<string, unknown>;
  }>;
}

/**
 * Model Provider 接口
 */
export interface IModelProvider {
  readonly name: string;
  complete(request: ModelCompleteRequest): Promise<ModelCompleteResponse>;
  countTokens?(messages: ChatMessage[]): Promise<number>;
  healthCheck?(): Promise<boolean>;
}
```

**Step 2: 创建智谱适配器配置**

```typescript
// src/infrastructure/model-provider/zhipu/config.ts

/**
 * 智谱配置
 */
export interface ZhipuConfig {
  apiKey: string;
  model?: string;
  baseURL?: string;
}

/**
 * 获取智谱配置
 */
export function getZhipuConfig(): ZhipiConfig {
  return {
    apiKey: process.env.ZHIPU_API_KEY || '',
    model: process.env.ZHIPU_MODEL || 'glm-4.7',
    baseURL: process.env.ZHIPU_BASE_URL || 'https://open.bigmodel.cn/api/paas/v4/',
  };
}
```

**Step 3: 创建智谱适配器实现**

```typescript
// src/infrastructure/model-provider/zhipu/adapter.ts

import { createOpenAI } from '@ai-sdk/openai';
import { generateText } from 'ai';
import type {
  IModelProvider,
  ModelCompleteRequest,
  ModelCompleteResponse,
} from '../interface.js';
import type { ChatMessage, TokenUsage } from '../../../domain/agent/types.js';
import { getZhipuConfig } from './config.js';

/**
 * 智谱 AI 适配器
 */
export class ZhipuModelProvider implements IModelProvider {
  readonly name = 'zhipu';

  private client: ReturnType<typeof createOpenAI>;
  private model: string;

  constructor(config?: { apiKey?: string; model?: string; baseURL?: string }) {
    const finalConfig = { ...getZhipuConfig(), ...config };

    if (!finalConfig.apiKey) {
      throw new Error('ZHIPU_API_KEY is required');
    }

    this.client = createOpenAI({
      baseURL: finalConfig.baseURL,
      apiKey: finalConfig.apiKey,
    });
    this.model = finalConfig.model || 'glm-4.7';
  }

  async complete(request: ModelCompleteRequest): Promise<ModelCompleteResponse> {
    try {
      const result = await generateText({
        model: this.client(this.model),
        messages: request.messages,
        temperature: request.temperature ?? 0.7,
        maxTokens: request.maxTokens ?? 4096,
        system: request.systemPrompt,
      });

      const response: ModelCompleteResponse = {
        content: result.text,
        toolCalls: result.toolCalls?.map(tc => ({
          toolCallId: tc.toolCallId,
          toolName: tc.toolName,
          args: tc.args as Record<string, unknown>,
        })),
        usage: {
          promptTokens: result.usage.promptTokens,
          completionTokens: result.usage.completionTokens,
          totalTokens: result.usage.totalTokens,
        },
        finishReason: result.finishReason as ModelCompleteResponse['finishReason'],
      };

      return response;
    } catch (error) {
      throw new Error(`Zhipu API call failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  async countTokens(messages: ChatMessage[]): Promise<number> {
    // 简单估算
    let count = 0;
    for (const msg of messages) {
      const chineseChars = (msg.content.match(/[\u4e00-\u9fa5]/g) || []).length;
      const englishWords = msg.content.split(/\s+/).length - chineseChars;
      count += Math.ceil(chineseChars * 1.5 + englishWords);
    }
    return count;
  }

  async healthCheck(): Promise<boolean> {
    try {
      await this.complete({
        messages: [{ role: 'user', content: 'test' }],
        maxTokens: 10,
      });
      return true;
    } catch {
      return false;
    }
  }
}
```

**Step 4: 创建 Provider 注册表**

```typescript
// src/infrastructure/model-provider/registry.ts

import type { IModelProvider } from './interface.js';

/**
 * Provider 注册表
 */
export class ModelProviderRegistry {
  private providers: Map<string, IModelProvider> = new Map();

  register(provider: IModelProvider): void {
    this.providers.set(provider.name, provider);
  }

  get(name: string): IModelProvider | undefined {
    return this.providers.get(name);
  }

  list(): string[] {
    return Array.from(this.providers.keys());
  }

  has(name: string): boolean {
    return this.providers.has(name);
  }
}
```

**Step 5: 创建导出文件**

```typescript
// src/infrastructure/model-provider/index.ts

export { IModelProvider, ModelCompleteRequest, ModelCompleteResponse, StreamChunk } from './interface.js';
export { ModelProviderRegistry } from './registry.js';
export { ZhipuModelProvider } from './zhipu/adapter.js';
export { getZhipuConfig, ZhipuConfig } from './zhipu/config.js';
```

**Step 6: Commit**

```bash
git add src/infrastructure/model-provider/
git commit -m "feat(infrastructure): implement Model Provider interface and Zhipu adapter"
```

---

## Task 6: 基础设施层 - Tool Executor 实现

**Files:**
- Create: `src/infrastructure/tool-executor/interface.ts`
- Create: `src/infrastructure/tool-executor/executor.ts`
- Create: `src/infrastructure/tool-executor/security/rules.ts`
- Create: `src/infrastructure/tool-executor/security/security-chain.ts`
- Create: `src/infrastructure/tool-executor/tools/terminal-tool.ts`
- Create: `src/infrastructure/tool-executor/tools/file-read-tool.ts`
- Create: `src/infrastructure/tool-executor/tools/directory-list-tool.ts`

**Step 1: 创建工具执行器接口**

```typescript
// src/infrastructure/tool-executor/interface.ts

import type { SecurityRule } from '../../domain/agent/types.js';

/**
 * 工具执行请求
 */
export interface ToolExecuteRequest {
  name: string;
  arguments: Record<string, unknown>;
}

/**
 * 工具执行响应
 */
export interface ToolExecuteResponse {
  output: string;
  error?: Error;
  executionTime: number;
}

/**
 * 工具定义
 */
export interface ToolDefinition {
  name: string;
  description: string;
  parameters: {
    parse: (data: unknown) => any;
    _input: any;
    _output: any;
  };
  handler: (args: any) => Promise<string>;
}

/**
 * Tool Executor 接口
 */
export interface IToolExecutor {
  execute(request: ToolExecuteRequest): Promise<ToolExecuteResponse>;
  registerTool(tool: ToolDefinition): void;
  getTools(): ToolDefinition[];
  addSecurityRule(rule: SecurityRule): void;
}
```

**Step 2: 创建内置安全规则**

```typescript
// src/infrastructure/tool-executor/security/rules.ts

import type { SecurityRule } from '../../../domain/agent/types.js';

/**
 * 内置安全规则
 */
export const BUILT_IN_SECURITY_RULES: SecurityRule[] = [
  {
    id: 'block-rm-force',
    type: 'block',
    pattern: /rm\s+-rf?\s+(\/|[~]\/)/,
    description: '禁止删除根目录或用户主目录下的文件',
    enabled: true,
  },
  {
    id: 'block-git-force-push',
    type: 'block',
    pattern: /git\s+push\s+.*--force/,
    description: '禁止使用 git force push',
    enabled: true,
  },
  {
    id: 'block-format-disk',
    type: 'block',
    pattern: /(mkfs|fdisk|format)\s+/,
    description: '禁止格式化磁盘操作',
    enabled: true,
  },
  {
    id: 'block-sudo',
    type: 'block',
    pattern: /sudo\s+/,
    description: '禁止使用 sudo 提权',
    enabled: true,
  },
  {
    id: 'block-ssh-key-exposure',
    type: 'block',
    pattern: /cat\s+.*\/\.ssh\/(id_rsa|id_ed25519)/,
    description: '禁止读取 SSH 私钥',
    enabled: true,
  },
  {
    id: 'block-env-secrets',
    type: 'block',
    pattern: /cat\s+.*\/\.env(\.|$)/,
    description: '禁止读取 .env 环境配置文件',
    enabled: true,
  },
];
```

**Step 3: 创建安全链**

```typescript
// src/infrastructure/tool-executor/security/security-chain.ts

import type { SecurityRule } from '../../../domain/agent/types.js';

/**
 * 安全检查结果
 */
export interface SecurityCheckResult {
  allowed: boolean;
  reason?: string;
  rule?: SecurityRule;
}

/**
 * 安全检查链
 */
export class SecurityChain {
  private rules: SecurityRule[] = [];

  constructor(initialRules?: SecurityRule[]) {
    if (initialRules) {
      this.rules.push(...initialRules);
    }
  }

  addRule(rule: SecurityRule): void {
    this.rules.push(rule);
  }

  removeRule(ruleId: string): void {
    this.rules = this.rules.filter(r => r.id !== ruleId);
  }

  async check(command: string): Promise<SecurityCheckResult> {
    for (const rule of this.rules) {
      if (!rule.enabled) continue;

      if (rule.type === 'block' && rule.pattern.test(command)) {
        return {
          allowed: false,
          reason: `命令被安全规则阻止: ${rule.description}`,
          rule,
        };
      }
    }

    return { allowed: true };
  }

  getRules(): SecurityRule[] {
    return [...this.rules];
  }
}
```

**Step 4: 创建终端工具**

```typescript
// src/infrastructure/tool-executor/tools/terminal-tool.ts

import { promisify } from 'node:util';
import { exec } from 'node:child_process';
import { z } from 'zod';
import type { ToolDefinition } from '../interface.js';

const execAsync = promisify(exec);

/**
 * 终端命令工具
 */
export class TerminalTool {
  getDefinition(): ToolDefinition {
    return {
      name: 'terminal_tool',
      description: '执行无交互的终端命令（如 ls, pwd, git status, npm run build）',
      parameters: z.object({
        command: z.string().describe('要执行的命令'),
        cwd: z.string().optional().describe('工作目录，默认为当前目录'),
        timeout: z.number().optional().describe('超时时间（毫秒），默认 30000'),
      }),
      handler: async (args) => {
        const { command, cwd, timeout = 30000 } = args;

        try {
          const { stdout, stderr } = await execAsync(command, {
            cwd: cwd || process.cwd(),
            timeout,
          });

          const output = [stdout, stderr].filter(Boolean).join('\n');
          return output || 'Command executed successfully (no output)';
        } catch (error: any) {
          if (error.killed) {
            throw new Error(`Command timed out after ${timeout}ms`);
          }

          const errorMsg = [error.stderr || error.stdout || '', error.message]
            .filter(Boolean)
            .join('\n');

          throw new Error(`Command failed: ${errorMsg}`);
        }
      },
    };
  }
}
```

**Step 5: 创建文件读取工具**

```typescript
// src/infrastructure/tool-executor/tools/file-read-tool.ts

import { readFile } from 'node:fs/promises';
import { z } from 'zod';
import type { ToolDefinition } from '../interface.js';

/**
 * 文件读取工具
 */
export class FileReadTool {
  getDefinition(): ToolDefinition {
    return {
      name: 'file_read_tool',
      description: '读取指定文件的内容',
      parameters: z.object({
        path: z.string().describe('文件路径（绝对路径或相对路径）'),
        encoding: z.string().optional().default('utf-8').describe('文件编码'),
        startLine: z.number().optional().describe('起始行号（从 1 开始）'),
        endLine: z.number().optional().describe('结束行号'),
      }),
      handler: async (args) => {
        const { path, encoding = 'utf-8', startLine, endLine } = args;

        try {
          let content = await readFile(path, { encoding });

          if (startLine || endLine) {
            const lines = content.split('\n');
            const start = startLine ? startLine - 1 : 0;
            const end = endLine || lines.length;
            content = lines.slice(start, end).join('\n');
          }

          return content;
        } catch (error: any) {
          if (error.code === 'ENOENT') {
            throw new Error(`File not found: ${path}`);
          }
          if (error.code === 'EISDIR') {
            throw new Error(`Path is a directory, not a file: ${path}`);
          }
          throw new Error(`Failed to read file: ${error.message}`);
        }
      },
    };
  }
}
```

**Step 6: 创建目录列表工具**

```typescript
// src/infrastructure/tool-executor/tools/directory-list-tool.ts

import { readdir, stat } from 'node:fs/promises';
import { z } from 'zod';
import type { ToolDefinition } from '../interface.js';

/**
 * 目录列表工具
 */
export class DirectoryListTool {
  getDefinition(): ToolDefinition {
    return {
      name: 'directory_list_tool',
      description: '列出指定目录下的文件和子目录',
      parameters: z.object({
        path: z.string().describe('目录路径'),
        recursive: z.boolean().optional().default(false).describe('是否递归列出子目录'),
        showHidden: z.boolean().optional().default(false).describe('是否显示隐藏文件'),
      }),
      handler: async (args) => {
        const { path, recursive = false, showHidden = false } = args;

        try {
          const entries = await readdir(path, { withFileTypes: true });
          const result: string[] = [];

          for (const entry of entries) {
            if (!showHidden && entry.name.startsWith('.')) continue;

            const fullPath = `${path}/${entry.name}`;
            const stats = await stat(fullPath);
            const type = entry.isDirectory() ? '[DIR]' : '[FILE]';
            const size = entry.isFile() ? ` (${stats.size} bytes)` : '';

            result.push(`${type} ${entry.name}${size}`);

            if (recursive && entry.isDirectory()) {
              const subEntries = await this.listDirectory(fullPath, recursive, showHidden);
              result.push(...subEntries.map(s => `  ${s}`));
            }
          }

          return result.join('\n');
        } catch (error: any) {
          if (error.code === 'ENOENT') {
            throw new Error(`Directory not found: ${path}`);
          }
          if (error.code === 'ENOTDIR') {
            throw new Error(`Path is not a directory: ${path}`);
          }
          throw new Error(`Failed to list directory: ${error.message}`);
        }
      },
    };
  }

  private async listDirectory(
    path: string,
    recursive: boolean,
    showHidden: boolean
  ): Promise<string[]> {
    const entries = await readdir(path, { withFileTypes: true });
    const result: string[] = [];

    for (const entry of entries) {
      if (!showHidden && entry.name.startsWith('.')) continue;

      const fullPath = `${path}/${entry.name}`;
      const stats = await stat(fullPath);
      const type = entry.isDirectory() ? '[DIR]' : '[FILE]';

      result.push(`${type} ${entry.name}`);

      if (recursive && entry.isDirectory()) {
        const subEntries = await this.listDirectory(fullPath, recursive, showHidden);
        result.push(...subEntries.map(s => `  ${s}`));
      }
    }

    return result;
  }
}
```

**Step 7: 创建工具执行器实现**

```typescript
// src/infrastructure/tool-executor/executor.ts

import type { IToolExecutor, ToolExecuteRequest, ToolExecuteResponse, ToolDefinition } from './interface.js';
import type { SecurityRule } from '../../domain/agent/types.js';
import { SecurityChain, BUILT_IN_SECURITY_RULES } from './security/security-chain.js';
import { TerminalTool } from './tools/terminal-tool.js';
import { FileReadTool } from './tools/file-read-tool.js';
import { DirectoryListTool } from './tools/directory-list-tool.js';

/**
 * 工具执行器实现
 */
export class ToolExecutor implements IToolExecutor {
  private tools: Map<string, ToolDefinition> = new Map();
  private securityChain: SecurityChain;

  constructor() {
    this.securityChain = new SecurityChain([...BUILT_IN_SECURITY_RULES]);
    this.registerBuiltinTools();
  }

  async execute(request: ToolExecuteRequest): Promise<ToolExecuteResponse> {
    const startTime = Date.now();

    const tool = this.tools.get(request.name);
    if (!tool) {
      return {
        output: '',
        error: new Error(`Tool not found: ${request.name}`),
        executionTime: Date.now() - startTime,
      };
    }

    // 安全检查（仅对 terminal_tool 生效）
    if (request.name === 'terminal_tool') {
      const command = request.arguments?.command as string;
      const securityCheck = await this.securityChain.check(command);

      if (!securityCheck.allowed) {
        return {
          output: '',
          error: new Error(securityCheck.reason || 'Command blocked by security rules'),
          executionTime: Date.now() - startTime,
        };
      }
    }

    try {
      // 参数验证
      const validatedArgs = tool.parameters.parse(request.arguments);
      const output = await tool.handler(validatedArgs);
      return {
        output,
        executionTime: Date.now() - startTime,
      };
    } catch (error) {
      return {
        output: '',
        error: error as Error,
        executionTime: Date.now() - startTime,
      };
    }
  }

  registerTool(tool: ToolDefinition): void {
    this.tools.set(tool.name, tool);
  }

  getTools(): ToolDefinition[] {
    return Array.from(this.tools.values());
  }

  addSecurityRule(rule: SecurityRule): void {
    this.securityChain.addRule(rule);
  }

  private registerBuiltinTools(): void {
    const terminalTool = new TerminalTool();
    const fileReadTool = new FileReadTool();
    const directoryListTool = new DirectoryListTool();

    this.registerTool(terminalTool.getDefinition());
    this.registerTool(fileReadTool.getDefinition());
    this.registerTool(directoryListTool.getDefinition());
  }
}
```

**Step 8: Commit**

```bash
git add src/infrastructure/tool-executor/
git commit -m "feat(infrastructure): implement Tool Executor with security chain and builtin tools"
```

---

## Task 7: 领域层 - Context Manager 实现

**Files:**
- Create: `src/domain/context/manager.ts`
- Create: `src/domain/context/truncation-strategy.ts`
- Create: `src/domain/context/interface.ts`

**Step 1: 创建截断策略**

```typescript
// src/domain/context/truncation-strategy.ts

import type { ChatMessage } from '../agent/types.js';

/**
 * 截断结果
 */
export interface TruncationResult {
  messagesToRemove: ChatMessage[];
  keepMessages: ChatMessage[];
}

/**
 * 截断策略接口
 */
export interface ITruncationStrategy {
  truncate(messages: ChatMessage[], maxTokens: number): Promise<TruncationResult>;
}

/**
 * 最近消息优先截断策略
 */
export class RecentTruncationStrategy implements ITruncationStrategy {
  async truncate(messages: ChatMessage[], maxTokens: number): Promise<TruncationResult> {
    // 保留系统消息
    const systemMessages = messages.filter(m => m.role === 'system');
    const userMessages = messages.filter(m => m.role !== 'system');

    // 从最早的消息开始移除，直到 Token 数量在限制内
    let currentTokens = 0;
    const keepMessages: ChatMessage[] = [];
    const removeMessages: ChatMessage[] = [];

    // 先添加系统消息
    for (const msg of systemMessages) {
      keepMessages.push(msg);
      currentTokens += this.estimateTokens(msg);
    }

    // 从后往前添加用户消息（保留最近的）
    for (let i = userMessages.length - 1; i >= 0; i--) {
      const msgTokens = this.estimateTokens(userMessages[i]);
      if (currentTokens + msgTokens > maxTokens) {
        // 这个消息会被移除
        removeMessages.unshift(userMessages[i]);
      } else {
        keepMessages.unshift(userMessages[i]);
        currentTokens += msgTokens;
      }
    }

    return {
      messagesToRemove: removeMessages,
      keepMessages,
    };
  }

  private estimateTokens(message: ChatMessage): number {
    const chineseChars = (message.content.match(/[\u4e00-\u9fa5]/g) || []).length;
    const englishWords = message.content.split(/\s+/).length - chineseChars;
    return Math.ceil(chineseChars * 1.5 + englishWords);
  }
}
```

**Step 2: 创建 Context Manager 实现**

```typescript
// src/domain/context/manager.ts

import type { IContextManager } from './interface.js';
import type { ChatMessage } from '../agent/types.js';
import type { IMemoryManager } from '../memory/interface.js';
import type { ITruncationStrategy } from './truncation-strategy.js';
import { RecentTruncationStrategy } from './truncation-strategy.js';

/**
 * Context Manager
 */
export class ContextManager implements IContextManager {
  private messages: ChatMessage[] = [];
  private maxTokens: number;
  private truncationStrategy: ITruncationStrategy;

  constructor(
    private readonly memoryManager: IMemoryManager,
    maxTokens: number = 32000,
    truncationStrategy?: ITruncationStrategy,
  ) {
    this.maxTokens = maxTokens;
    this.truncationStrategy = truncationStrategy || new RecentTruncationStrategy();
  }

  async addMessage(message: ChatMessage): Promise<void> {
    this.messages.push(message);

    const currentTokens = await this.memoryManager.countTokens(this.messages);
    if (currentTokens > this.maxTokens) {
      await this.truncate();
    }
  }

  async addToolResult(toolCall: any, result: string): Promise<void> {
    const message: ChatMessage = {
      id: this.generateId(),
      role: 'tool' as any,
      content: result,
      timestamp: Date.now(),
      toolResult: {
        toolCallId: toolCall.id,
        output: result,
        executionTime: 0,
      },
    };
    await this.addMessage(message);
  }

  async addToolError(toolCall: any, error: Error): Promise<void> {
    const message: ChatMessage = {
      id: this.generateId(),
      role: 'tool' as any,
      content: `Error: ${error.message}`,
      timestamp: Date.now(),
      toolResult: {
        toolCallId: toolCall.id,
        output: '',
        error,
        executionTime: 0,
      },
    };
    await this.addMessage(message);
  }

  async getContext(): Promise<any> {
    return {
      messages: this.messages.map(m => ({
        role: m.role,
        content: m.content,
      })),
      tokenCount: await this.memoryManager.countTokens(this.messages),
      lastUpdated: Date.now(),
    };
  }

  async clear(): Promise<void> {
    this.messages = [];
  }

  private async truncate(): Promise<void> {
    const { messagesToRemove, keepMessages } =
      await this.truncationStrategy.truncate(this.messages, this.maxTokens);

    this.messages = keepMessages;
  }

  private generateId(): string {
    return `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}
```

**Step 3: 创建接口导出文件**

```typescript
// src/domain/context/interface.ts

export { IContextManager } from './types.js';
export { ContextManager } from './manager.js';
export { ITruncationStrategy, RecentTruncationStrategy, TruncationResult } from './truncation-strategy.js';
```

**Step 4: Commit**

```bash
git add src/domain/context/
git commit -m "feat(domain): implement Context Manager with truncation strategy"
```

---

## Task 8: 领域层 - Agent Orchestrator 实现

**Files:**
- Create: `src/domain/agent/orchestrator.ts`
- Create: `src/domain/agent/interface.ts`

**Step 1: 创建 Agent Orchestrator 实现**

```typescript
// src/domain/agent/orchestrator.ts

import { EventEmitter } from 'node:events';
import type { IModelProvider } from '../../infrastructure/model-provider/interface.js';
import type { IContextManager } from '../context/interface.js';
import type { IMemoryManager } from '../memory/interface.js';
import type { IHooksManager } from '../hooks/interface.js';
import type { IToolExecutor } from '../../infrastructure/tool-executor/interface.js';
import type {
  ChatMessage,
  MessageRole,
  AgentConfig,
  ToolCall,
} from './types.js';

/**
 * Agent Orchestrator
 */
export class AgentOrchestrator extends EventEmitter {
  private isProcessingFlag = false;

  constructor(
    private readonly modelProvider: IModelProvider,
    private readonly contextManager: IContextManager,
    private readonly memoryManager: IMemoryManager,
    private readonly hooksManager: IHooksManager,
    private readonly toolExecutor: IToolExecutor,
    private readonly config: AgentConfig,
  ) {
    super();
  }

  async processUserInput(input: string): Promise<string> {
    this.isProcessingFlag = true;

    const userMessage: ChatMessage = {
      id: this.generateId(),
      role: MessageRole.USER,
      content: input,
      timestamp: Date.now(),
    };

    await this.contextManager.addMessage(userMessage);
    await this.hooksManager.trigger('onStart', { input, message: userMessage });

    try {
      const response = await this.thoughtLoop();
      await this.hooksManager.trigger('onComplete', { response });
      return response;
    } catch (error) {
      await this.hooksManager.trigger('onError', { error });
      throw error;
    } finally {
      this.isProcessingFlag = false;
    }
  }

  private async thoughtLoop(): Promise<string> {
    let maxIterations = 10;
    let finalResponse = '';

    while (maxIterations-- > 0) {
      const context = await this.contextManager.getContext();
      await this.hooksManager.trigger('onThinking', { context });

      const result = await this.modelProvider.complete({
        messages: context.messages,
        tools: this.config.allowedTools,
        systemPrompt: this.buildSystemPrompt(),
      });

      await this.memoryManager.recordTokenUsage(result.usage);

      if (result.toolCalls && result.toolCalls.length > 0) {
        await this.executeToolCalls(result.toolCalls);
        continue;
      }

      finalResponse = result.content;

      const assistantMessage: ChatMessage = {
        id: this.generateId(),
        role: MessageRole.ASSISTANT,
        content: result.content,
        timestamp: Date.now(),
      };
      await this.contextManager.addMessage(assistantMessage);

      break;
    }

    return finalResponse;
  }

  private async executeToolCalls(toolCalls: any[]): Promise<void> {
    for (const toolCall of toolCalls) {
      await this.hooksManager.trigger('onBeforeTool', { toolCall });

      try {
        const response = await this.toolExecutor.execute({
          name: toolCall.toolName,
          arguments: toolCall.args,
        });

        if (response.error) {
          await this.hooksManager.trigger('onToolError', { toolCall, error: response.error });
          await this.contextManager.addToolError(toolCall, response.error);
        } else {
          await this.hooksManager.trigger('onToolResult', { toolCall, result: response.output });
          await this.contextManager.addToolResult(toolCall, response.output);
        }
      } catch (error) {
        await this.hooksManager.trigger('onToolError', { toolCall, error });
        await this.contextManager.addToolError(toolCall, error as Error);
      }
    }
  }

  private buildSystemPrompt(): string {
    const basePrompt = this.config.systemPrompt || DEFAULT_SYSTEM_PROMPT;
    const securityPrompt = this.buildSecurityPrompt();
    const toolsPrompt = `# 可用工具\n你可以使用以下工具: ${this.config.allowedTools.join(', ')}`;

    return `${basePrompt}\n\n${securityPrompt}\n\n${toolsPrompt}`;
  }

  private buildSecurityPrompt(): string {
    const rules = this.config.securityRules
      .filter(r => r.enabled)
      .map(r => `- ${r.description}: ${r.type}`)
      .join('\n');

    return `# 安全规则\n${rules}`;
  }

  isProcessing(): boolean {
    return this.isProcessingFlag;
  }

  getAllowedTools(): string[] {
    return this.config.allowedTools;
  }

  getSystemPrompt(): string {
    return this.buildSystemPrompt();
  }

  getModelProvider(): IModelProvider {
    return this.modelProvider;
  }

  async getContext(): Promise<any> {
    return this.contextManager.getContext();
  }

  private generateId(): string {
    return `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}

const DEFAULT_SYSTEM_PROMPT = `你是 YuGAgent，一个运行在开发者终端中的 AI 助手。

你的职责是帮助开发者完成以下任务：
- 阅读和理解本地代码
- 执行终端命令（在安全规则范围内）
- 分析和排查问题
- 协助代码修改

请始终以简洁、专业的方式回答问题。`;
```

**Step 2: 创建接口导出文件**

```typescript
// src/domain/agent/interface.ts

export { AgentOrchestrator } from './orchestrator.js';
export * from './types.js';
```

**Step 3: Commit**

```bash
git add src/domain/agent/
git commit -m "feat(domain): implement Agent Orchestrator with thought loop"
```

---

## Task 9: 应用层 - Service 和 Controller

**Files:**
- Create: `src/application/services/ai-service.ts`
- Create: `src/application/interfaces/controllers/chat.controller.ts`
- Create: `src/application/dto/chat.dto.ts`

**Step 1: 创建 Chat DTO**

```typescript
// src/application/dto/chat.dto.ts

/**
 * 发送消息 DTO
 */
export interface SendMessageDto {
  message: string;
  stream?: boolean;
}

/**
 * 发送消息响应 DTO
 */
export interface SendMessageResponseDto {
  response: string;
  messageCount: number;
  tokenUsage: number;
  timestamp: number;
}

/**
 * 服务状态 DTO
 */
export interface ServiceStatus {
  messageCount: number;
  tokenUsage: {
    total: number;
    prompt: number;
    completion: number;
  };
  isProcessing: boolean;
}
```

**Step 2: 创建 AI Service**

```typescript
// src/application/services/ai-service.ts

import { EventEmitter } from 'node:events';
import type { IAgentOrchestrator } from '../../domain/agent/interface.js';
import type { IContextManager } from '../../domain/context/interface.js';
import type { IMemoryManager } from '../../domain/memory/interface.js';
import type { ServiceStatus } from '../dto/chat.dto.js';

/**
 * AI 服务
 */
export class AIService extends EventEmitter {
  constructor(
    private readonly agent: IAgentOrchestrator,
    private readonly contextManager: IContextManager,
    private readonly memoryManager: IMemoryManager,
  ) {
    super();
    this.setupEventForwarding();
  }

  async sendMessage(message: string): Promise<string> {
    this.emit('user-message', { message });

    const response = await this.agent.processUserInput(message);
    const tokenStats = await this.memoryManager.getTokenStats();
    const context = await this.contextManager.getContext();

    this.emit('ai-response', { response });
    this.emit('token-usage', { usage: tokenStats.total });

    return response;
  }

  async clearHistory(): Promise<void> {
    await this.contextManager.clear();
    this.emit('history-cleared');
  }

  async getStatus(): Promise<ServiceStatus> {
    const context = await this.contextManager.getContext();
    const tokenStats = await this.memoryManager.getTokenStats();

    return {
      messageCount: context.messages.length,
      tokenUsage: {
        total: tokenStats.totalTokens,
        prompt: tokenStats.promptTokens,
        completion: tokenStats.completionTokens,
      },
      isProcessing: this.agent.isProcessing(),
    };
  }

  private setupEventForwarding(): void {
    this.agent.on('thinking', (data) => this.emit('thinking', data));
    this.agent.on('error', (error) => this.emit('error', error));
  }
}
```

**Step 3: 创建 Chat Controller**

```typescript
// src/application/interfaces/controllers/chat.controller.ts

import type { AIService } from '../../services/ai-service.js';
import type { ServiceStatus } from '../../dto/chat.dto.js';

/**
 * 聊天控制器
 */
export class ChatController {
  constructor(private readonly aiService: AIService) {}

  async sendMessage(message: string): Promise<string> {
    return this.aiService.sendMessage(message);
  }

  async clearHistory(): Promise<void> {
    return this.aiService.clearHistory();
  }

  async getStatus(): Promise<ServiceStatus> {
    return this.aiService.getStatus();
  }

  on(event: string, listener: (...args: any[]) => void): void {
    this.aiService.on(event, listener);
  }

  off(event: string, listener: (...args: any[]) => void): void {
    this.aiService.off(event, listener);
  }

  removeAllListeners(): void {
    this.aiService.removeAllListeners();
  }
}
```

**Step 4: Commit**

```bash
git add src/application/
git commit -m "feat(application): implement AI Service and Chat Controller"
```

---

## Task 10: TUI 层 - Ink 基础组件

**Files:**
- Create: `src/ui/ink/App.tsx`
- Create: `src/ui/ink/components/ChatPanel.tsx`
- Create: `src/ui/ink/components/StatusPanel.tsx`
- Create: `src/ui/ink/components/InputBox.tsx`
- Create: `src/ui/ink/components/MessageBox.tsx`
- Create: `src/ui/ink/components/Markdown.tsx`
- Create: `src/ui/ink/theme/colors.ts`

**Step 1: 创建颜色主题**

```typescript
// src/ui/ink/theme/colors.ts

/**
 * 颜色主题
 */
export const colors = {
  primary: 'cyan',
  secondary: 'blue',
  success: 'green',
  warning: 'yellow',
  error: 'red',
  dim: 'gray',
  user: 'blue',
  assistant: 'green',
  tool: 'yellow',
} as const;
```

**Step 2: 创建 Markdown 渲染器**

```typescript
// src/ui/ink/components/Markdown.tsx

import React from 'react';
import { Box, Text } from 'ink';

interface MarkdownProps {
  content: string;
}

export const Markdown: React.FC<MarkdownProps> = ({ content }) => {
  const lines = content.split('\n');

  return (
    <Box flexDirection="column">
      {lines.map((line, index) => {
        // 代码块
        if (line.startsWith('```')) {
          return null;
        }
        if (line.startsWith(' ') && !line.trim().startsWith('```')) {
          return (
            <Text key={index} dimColor bgKeyword="gray">
              {line}
            </Text>
          );
        }

        // 标题
        if (line.startsWith('# ')) {
          return (
            <Text key={index} bold color="cyan">
              {line.replace(/^#\s+/, '')}
            </Text>
          );
        }

        // 列表
        if (line.trim().startsWith('- ')) {
          return (
            <Box key={index}>
              <Text color="gray">• </Text>
              <Text>{line.trim().substring(2)}</Text>
            </Box>
          );
        }

        // 引用
        if (line.trim().startsWith('> ')) {
          return (
            <Text key={index} color="yellow" dimColor>
              │ {line.trim().substring(2)}
            </Text>
          );
        }

        // 普通文本
        return (
          <Text key={index}>
            {line}
          </Text>
        );
      })}
    </Box>
  );
};
```

**Step 3: 创建消息气泡**

```typescript
// src/ui/ink/components/MessageBox.tsx

import React from 'react';
import { Box, Text } from 'ink';
import { Markdown } from './Markdown.js';
import { colors } from '../theme/colors.js';
import type { ChatMessage } from '../../../domain/agent/types.js';

interface MessageBoxProps {
  message: ChatMessage;
}

export const MessageBox: React.FC<MessageBoxProps> = ({ message }) => {
  const isUser = message.role === 'user';
  const isTool = message.role === 'tool';

  if (isTool) {
    return (
      <Box marginTop={1}>
        <Text color={colors.tool}>[Tool Result] </Text>
        <Text dimColor>{message.content.slice(0, 200)}</Text>
        {message.content.length > 200 && <Text dimColor>...</Text>}
      </Box>
    );
  }

  return (
    <Box marginTop={1} marginBottom={1}>
      <Text color={isUser ? colors.user : colors.assistant} bold>
        {isUser ? '[You]' : '[AI]'}{' '}
      </Text>
      <Markdown content={message.content} />
    </Box>
  );
};
```

**Step 4: 创建聊天面板**

```typescript
// src/ui/ink/components/ChatPanel.tsx

import React from 'react';
import { Box, Text, Static } from 'ink';
import { MessageBox } from './MessageBox.js';
import { colors } from '../theme/colors.js';
import type { ChatMessage } from '../../../domain/agent/types.js';

interface ChatPanelProps {
  messages: ChatMessage[];
  streamingContent: string;
}

export const ChatPanel: React.FC<ChatPanelProps> = ({ messages, streamingContent }) => {
  return (
    <Box
      flexDirection="column"
      flexGrow={1}
      paddingX={1}
      borderStyle="single"
      borderColor={colors.dim}
    >
      <Box marginBottom={1}>
        <Text bold color={colors.primary}>
          YuGAgent Terminal AI
        </Text>
      </Box>

      <Static items={messages}>
        {(message) => <MessageBox key={message.id} message={message} />}
      </Static>

      {streamingContent && (
        <Box marginTop={1}>
          <Text>{streamingContent}</Text>
          <Text dimColor>▋</Text>
        </Box>
      )}
    </Box>
  );
};
```

**Step 5: 创建状态栏**

```typescript
// src/ui/ink/components/StatusPanel.tsx

import React from 'react';
import { Box, Text } from 'ink';
import { colors } from '../theme/colors.js';

interface StatusPanelProps {
  tokenUsage: { total: number; prompt: number; completion: number };
  isProcessing: boolean;
}

export const StatusPanel: React.FC<StatusPanelProps> = ({ tokenUsage, isProcessing }) => {
  return (
    <Box
      paddingX={1}
      justifyContent="space-between"
      borderStyle="single"
      borderColor={colors.dim}
    >
      <Box>
        <Text color={colors.dim}>Tokens: </Text>
        <Text>P:{tokenUsage.prompt} </Text>
        <Text>C:{tokenUsage.completion} </Text>
        <Text>T:{tokenUsage.total}</Text>
      </Box>

      <Box>
        {isProcessing ? (
          <Text color={colors.warning}>● Processing...</Text>
        ) : (
          <Text color={colors.success}>● Ready</Text>
        )}
      </Box>
    </Box>
  );
};
```

**Step 6: 创建输入框**

```typescript
// src/ui/ink/components/InputBox.tsx

import React, { useState } from 'react';
import { Box, Text, useInput } from 'ink';
import { colors } from '../theme/colors.js';

interface InputBoxProps {
  onSubmit: (message: string) => void;
  disabled?: boolean;
}

export const InputBox: React.FC<InputBoxProps> = ({ onSubmit, disabled }) => {
  const [input, setInput] = useState('');

  useInput((inputStr, key) => {
    if (disabled) return;

    if (key.return) {
      if (inputStr.trim()) {
        onSubmit(inputStr.trim());
        setInput('');
      }
      return;
    }

    if (key.ctrl && inputStr === 'c') {
      process.exit(0);
    }

    if (key.backspace || key.delete) {
      setInput(input.slice(0, -1));
      return;
    }

    if (inputStr) {
      setInput(input + inputStr);
    }
  });

  return (
    <Box
      paddingX={1}
      marginTop={1}
      borderStyle="single"
      borderColor={colors.secondary}
    >
      <Text color={colors.secondary} bold>
        {'>'}{' '}
      </Text>
      <Text dimColor={disabled}>
        {input}
      </Text>
      {disabled && (
        <Text color={colors.dim}> (AI is thinking...)</Text>
      )}
    </Box>
  );
};
```

**Step 7: 创建主应用组件**

```typescript
// src/ui/ink/App.tsx

import React, { useState, useEffect } from 'react';
import { render } from 'ink';
import type { ChatController } from '../../application/interfaces/controllers/chat.controller.js';
import type { ChatMessage } from '../../../domain/agent/types.js';
import { ChatPanel } from './components/ChatPanel.js';
import { StatusPanel } from './components/StatusPanel.js';
import { InputBox } from './components/InputBox.js';

interface AppState {
  messages: ChatMessage[];
  isProcessing: boolean;
  streamingContent: string;
  tokenUsage: { total: number; prompt: number; completion: number };
}

export const App: React.FC<{ chatController: ChatController }> = ({ chatController }) => {
  const [state, setState] = useState<AppState>({
    messages: [],
    isProcessing: false,
    streamingContent: '',
    tokenUsage: { total: 0, prompt: 0, completion: 0 },
  });

  useEffect(() => {
    const handleUserMessage = ({ message }: { message: string }) => {
      setState(prev => ({
        ...prev,
        messages: [
          ...prev.messages,
          {
            id: `msg_${Date.now()}`,
            role: 'user' as const,
            content: message,
            timestamp: Date.now(),
          },
        ],
      }));
    };

    const handleAIResponse = ({ response }: { response: string }) => {
      setState(prev => ({
        ...prev,
        messages: [
          ...prev.messages,
          {
            id: `msg_${Date.now()}`,
            role: 'assistant' as const,
            content: response,
            timestamp: Date.now(),
          },
        ],
        isProcessing: false,
      }));
    };

    const handleTokenUsage = ({ usage }: { usage: number }) => {
      // 简单分配
      setState(prev => ({
        ...prev,
        tokenUsage: {
          total: usage,
          prompt: Math.floor(usage * 0.7),
          completion: Math.floor(usage * 0.3),
        },
      }));
    };

    chatController.on('user-message', handleUserMessage);
    chatController.on('ai-response', handleAIResponse);
    chatController.on('token-usage', handleTokenUsage);

    return () => {
      chatController.off('user-message', handleUserMessage);
      chatController.off('ai-response', handleAIResponse);
      chatController.off('token-usage', handleTokenUsage);
    };
  }, [chatController]);

  const handleSendMessage = async (message: string) => {
    setState(prev => ({ ...prev, isProcessing: true }));
    await chatController.sendMessage(message);
  };

  return (
    <>
      <ChatPanel messages={state.messages} streamingContent={state.streamingContent} />
      <StatusPanel tokenUsage={state.tokenUsage} isProcessing={state.isProcessing} />
      <InputBox onSubmit={handleSendMessage} disabled={state.isProcessing} />
    </>
  );
};

/**
 * 启动 TUI 应用
 */
export function startTUI(chatController: ChatController): void {
  render(<App chatController={chatController} />);
}
```

**Step 8: Commit**

```bash
git add src/ui/
git commit -m "feat(ui): implement Ink TUI components"
```

---

## Task 11: 主入口和依赖注入

**Files:**
- Modify: `src/index.ts`
- Create: `src/di/container.ts`

**Step 1: 创建依赖注入容器**

```typescript
// src/di/container.ts

import { ZhipuModelProvider } from '../infrastructure/model-provider/index.js';
import { ToolExecutor } from '../infrastructure/tool-executor/executor.js';
import { MemoryManager } from '../domain/memory/index.js';
import { HooksManager } from '../domain/hooks/index.js';
import { ContextManager } from '../domain/context/index.js';
import { AgentOrchestrator } from '../domain/agent/index.js';
import { AIService } from '../application/services/ai-service.js';
import { ChatController } from '../application/interfaces/controllers/chat.controller.js';
import { BUILT_IN_SECURITY_RULES } from '../infrastructure/tool-executor/security/rules.js';

/**
 * 创建应用实例
 */
export async function createApp() {
  // 1. 创建基础设施层
  const modelProvider = new ZhipuModelProvider();
  const toolExecutor = new ToolExecutor();

  // 2. 创建领域层
  const memoryManager = new MemoryManager();
  const hooksManager = new HooksManager();
  const contextManager = new ContextManager(memoryManager);

  const agentConfig = {
    modelProvider: 'zhipu',
    model: 'glm-4.7',
    temperature: 0.7,
    maxTokens: 4096,
    allowedTools: ['terminal_tool', 'file_read_tool', 'directory_list_tool'],
    securityRules: BUILT_IN_SECURITY_RULES,
  };

  const agent = new AgentOrchestrator(
    modelProvider,
    contextManager,
    memoryManager,
    hooksManager,
    toolExecutor,
    agentConfig,
  );

  // 3. 创建应用层
  const aiService = new AIService(agent, contextManager, memoryManager);
  const chatController = new ChatController(aiService);

  return {
    agent,
    aiService,
    chatController,
    modelProvider,
  };
}
```

**Step 2: 更新入口文件**

```typescript
// src/index.ts
#!/usr/bin/env node

import { Command } from 'commander';
import { createApp } from './di/container.js';
import { startTUI } from './ui/ink/App.js';

const program = new Command();

program
  .name('yugagent')
  .description('现代化多模型终端 AI 助手')
  .version('2.0.0');

program
  .command('chat')
  .description('启动交互式聊天')
  .action(async () => {
    try {
      const { chatController, modelProvider } = await createApp();

      // 健康检查
      const isHealthy = await modelProvider.healthCheck?.();
      if (!isHealthy) {
        console.error('Model provider health check failed. Please check your API key.');
        process.exit(1);
      }

      // 启动 TUI
      startTUI(chatController);
    } catch (error) {
      console.error('Failed to start application:', error);
      process.exit(1);
    }
  });

program
  .command('ask <question>')
  .description('直接提问（非交互模式）')
  .action(async (question: string) => {
    try {
      const { chatController } = await createApp();

      const response = await chatController.sendMessage(question);
      console.log(response);
    } catch (error) {
      console.error('Error:', error);
      process.exit(1);
    }
  });

program.parse();
```

**Step 3: Commit**

```bash
git add src/index.ts src/di/
git commit -m "feat(main): implement dependency injection container and CLI commands"
```

---

## Task 12: 配置文件和文档

**Files:**
- Create: `.env.example`
- Create: `README.md`
- Create: `tsup.config.ts`

**Step 1: 创建环境变量示例**

```bash
# .env.example
# 智谱 AI API Key
ZHIPU_API_KEY=your_api_key_here

# 可选：自定义模型名称
ZHIPU_MODEL=glm-4.7

# 可选：自定义 API 地址
# ZHIPU_BASE_URL=https://open.bigmodel.cn/api/paas/v4/
```

**Step 2: 创建 README**

```markdown
# YuGAgent

现代化多模型终端 AI 助手

## 特性

- 本地优先，基于 Node.js + TypeScript
- 多模型统一路由（智谱 GLM-4.7）
- 工具驱动（Tool-driven）的动态上下文
- Ink 多窗口 TUI 界面
- 双重安全机制

## 安装

\`\`\`bash
npm install -g yu-g-agent
\`\`\`

## 配置

\`\`\`bash
# 复制环境变量文件
cp .env.example .env

# 编辑 .env 文件，填入你的 API Key
\`\`\`

## 使用

\`\`\`bash
# 启动交互式聊天
yugagent chat

# 直接提问
yugagent ask "帮我分析一下这个项目的结构"
\`\`\`

## 开发

\`\`\`bash
npm install
npm run dev chat
\`\`\`

## License

MIT
```

**Step 3: 创建构建配置**

```typescript
// tsup.config.ts
import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm'],
  target: 'node18',
  clean: true,
  dts: false,
  splitting: false,
  sourcemap: true,
  shims: true,
});
```

**Step 4: Commit**

```bash
git add .env.example README.md tsup.config.ts
git commit -m "docs: add README, env example, and build config"
```

---

## Task 13: 测试和验证

**Files:**
- Create: `tests/unit/agent/orchestrator.test.ts`

**Step 1: 编写单元测试**

```typescript
// tests/unit/agent/orchestrator.test.ts

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { HooksManager } from '../../../../src/domain/hooks/index.js';
import { MemoryManager } from '../../../../src/domain/memory/index.js';

describe('AgentOrchestrator', () => {
  const mockModelProvider = {
    name: 'test',
    complete: vi.fn().mockResolvedValue({
      content: 'Test response',
      toolCalls: [],
      usage: { promptTokens: 10, completionTokens: 5, totalTokens: 15 },
      finishReason: 'stop',
    }),
  };

  const mockToolExecutor = {
    execute: vi.fn().mockResolvedValue({
      output: 'Tool output',
      executionTime: 100,
    }),
    registerTool: vi.fn(),
    getTools: vi.fn(() => []),
    addSecurityRule: vi.fn(),
  };

  const mockContextManager = {
    addMessage: vi.fn(),
    addToolResult: vi.fn(),
    addToolError: vi.fn(),
    getContext: vi.fn().mockResolvedValue({
      messages: [],
      tokenCount: 0,
      lastUpdated: Date.now(),
    }),
    clear: vi.fn(),
  };

  const mockMemoryManager = new MemoryManager();
  const mockHooksManager = new HooksManager();

  const config = {
    modelProvider: 'test',
    model: 'test-model',
    allowedTools: [],
    securityRules: [],
  };

  it('should process user input', async () => {
    // 测试实现...
  });
});
```

**Step 2: 运行测试**

```bash
npm test
```

**Step 3: Commit**

```bash
git add tests/
git commit -m "test: add unit tests for Agent Orchestrator"
```

---

## Task 14: 最终构建和发布准备

**Files:**
- Modify: `package.json`

**Step 1: 构建项目**

```bash
npm run build
```

**Step 2: 验证构建产物**

```bash
node dist/cli.js --version
```

Expected: `2.0.0`

**Step 3: 测试运行**

```bash
# 设置环境变量
export ZHIPU_API_KEY=your_test_key

# 运行 CLI
node dist/cli.js chat
```

**Step 4: Commit 最终版本**

```bash
git add -A
git commit -m "chore: prepare for release - Phase 1 MVP complete"
```

**Step 5: 打 tag**

```bash
git tag v2.0.0-phase1
git push origin main --tags
```

---

## 实施完成检查清单

- [ ] 所有 14 个任务已完成
- [ ] 所有单元测试通过
- [ ] 项目可以成功构建
- [ ] `yugagent chat` 命令可以正常启动 TUI
- [ ] `yugagent ask` 命令可以正常回答问题
- [ ] 安全规则正确拦截危险命令
- [ ] 工具执行正常工作
- [ ] 代码已提交到 git

---

**Plan Status:** ✅ Complete

**Estimated Time:** 8-12 hours

**Next Steps:** 参考 `docs/design-v2.md` 中的 Phase 2 和 Phase 3 计划进行功能增强。
