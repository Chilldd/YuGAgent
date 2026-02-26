# YuGAgent V2 架构设计文档

**项目名称**: YuGAgent
**版本**: V2.0
**设计日期**: 2026-02-26
**架构模式**: 分层洋葱架构 (Clean Architecture + Event-Driven)

---

## 1. 设计概述

### 1.1 项目定位

YuGAgent 是一款现代化的多模型终端 AI 助手，运行在开发者的本地终端中，能够读取本地代码、执行系统命令，并通过多轮对话自主完成项目理解、环境排查和代码修改任务。

### 1.2 核心特性

| 特性 | 说明 |
|------|------|
| 本地优先 | 基于 Node.js 构建，天然契合前端/全栈开发者生态 |
| 多模型统一路由 | 支持智谱 GLM、OpenAI、Ollama 等多种模型 |
| Agentic 原生设计 | 工具驱动（Tool-driven）的动态上下文策略 |
| 事件驱动架构 | UI 层与核心层完全解耦 |
| 双重安全机制 | Prompt 层规则 + 本地执行层拦截 |

### 1.3 Phase 1 MVP 范围

- **模型接入**: 智谱 AI (GLM-4.7)
- **基础工具**: run_command, read_file, list_directory
- **TUI 界面**: 完整的 Ink 多窗口界面
- **安全机制**: 内置安全规则 + 可配置扩展

---

## 2. 整体架构

### 2.1 架构图

```
┌─────────────────────────────────────────────────────────────────────────┐
│                              TUI PRESENTATION LAYER                     │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐         │
│  │   ChatPanel     │  │   ToolPanel     │  │   StatusPanel   │         │
│  │  (对话主窗口)    │  │  (工具执行状态)  │  │  (系统状态栏)    │         │
│  └─────────────────┘  └─────────────────┘  └─────────────────┘         │
└─────────────────────────────────────┬───────────────────────────────────┘
                                      │
                    ┌─────────────────▼──────────────────┐
                    │      TUI Controller (Orchestrator)  │
                    │     - 统一管理 Ink 渲染循环         │
                    │     - 监听 Core 层事件并更新 UI     │
                    └─────────────────┬──────────────────┘
                                      │ EventEmitter (Bidirectional)
┌─────────────────────────────────────▼───────────────────────────────────┐
│                           APPLICATION LAYER                              │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐         │
│  │  ChatUseCase    │  │  ToolUseCase    │  │ ConfigUseCase   │         │
│  │  - 处理用户输入  │  │  - 执行工具命令  │  │  - 配置加载/验证 │         │
│  │  - 管理对话流    │  │  - 安全规则检查  │  │  - 环境变量管理  │         │
│  └─────────────────┘  └─────────────────┘  └─────────────────┘         │
└─────────────────────────────────────┬───────────────────────────────────┘
                                      │
┌─────────────────────────────────────▼───────────────────────────────────┐
│                              DOMAIN LAYER (Core)                         │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │                        Agent Orchestrator                        │   │
│  │  - 编排整个 Thought→Action→Observation 循环                     │   │
│  │  - 管理 LLM 调用与 Tool Calling 协商                            │   │
│  └─────────────────────────────────┬───────────────────────────────┘   │
│                                    │                                   │
│  ┌─────────────────┐  ┌───────────▼────────────┐  ┌─────────────────┐  │
│  │  Hooks Manager  │  │    Context Manager     │  │  Memory Manager │  │
│  │  - 生命周期钩子  │  │  - 会话上下文管理      │  │  - Token 计数    │  │
│  │  - 事件发布订阅  │  │  - 消息历史截断       │  │  - 历史持久化    │  │
│  │  - 中间件链      │  │  - 向量存储接口(预留)  │  │  - 向量DB接口    │  │
│  └─────────────────┘  └───────────────────────┘  └─────────────────┘  │
└─────────────────────────────────────┬───────────────────────────────────┘
                                      │ 依赖接口 (DI)
┌─────────────────────────────────────▼───────────────────────────────────┐
│                        INFRASTRUCTURE LAYER                              │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │                     Model Provider Interface                     │   │
│  │  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐  │   │
│  │  │  IModelProvider │  │   ZhipuAdapter  │  │  (OpenAI/Ollama)│  │   │
│  │  │  <interface>    │──│  (Phase 1)      │──│  (Future)       │  │   │
│  │  └─────────────────┘  └─────────────────┘  └─────────────────┘  │   │
│  └─────────────────────────────────────────────────────────────────┘   │
│                                                                          │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │                       Tool Executor Chain                        │   │
│  │                                                                  │   │
│  │  用户输入 → 安全规则拦截 → 命令执行 → 结果过滤 → 返回           │   │
│  └─────────────────────────────────────────────────────────────────┘   │
│                                                                          │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │                    Storage Adapter Interface                     │   │
│  └─────────────────────────────────────────────────────────────────┘   │
└──────────────────────────────────────────────────────────────────────────┘
```

### 2.2 架构原则

1. **依赖倒置**: Domain Layer 不依赖 Infrastructure，而是依赖接口
2. **单一职责**: 每个层次只处理自己层级的逻辑
3. **事件驱动**: 层与层之间通过 EventEmitter 解耦
4. **依赖注入**: 所有外部依赖通过接口注入

---

## 3. 领域层设计

### 3.1 目录结构

```
src/domain/
├── agent/
│   ├── types.ts                    # 领域模型定义
│   ├── orchestrator.ts             # Agent 核心编排器
│   ├── thought-loop.ts             # 思考循环处理器
│   └── interface.ts                # Agent 接口
│
├── context/
│   ├── types.ts                    # Context 相关类型
│   ├── manager.ts                  # Context 管理器
│   ├── message-queue.ts            # 消息队列管理
│   ├── truncation-strategy.ts      # Token 截断策略
│   └── interface.ts                # Context 接口
│
├── memory/
│   ├── types.ts                    # Memory 相关类型
│   ├── manager.ts                  # Memory 管理器
│   ├── token-counter.ts            # Token 计数器
│   ├── session-store.ts            # 会话存储（内存）
│   └── interface.ts                # Memory 接口
│
├── hooks/
│   ├── types.ts                    # Hooks 类型定义
│   ├── manager.ts                  # Hooks 管理器
│   ├── middleware-chain.ts         # 中间件链执行器
│   └── interface.ts                # Hooks 接口
│
└── events/
    ├── event-bus.ts                # 事件总线
    └── event-types.ts              # 事件类型定义
```

### 3.2 核心领域模型

```typescript
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
 * Agent 配置
 */
export interface AgentConfig {
  modelProvider: string;           // 'zhipu' | 'openai' | 'ollama'
  model: string;                   // 'glm-4.7' | 'gpt-4' | etc.
  temperature?: number;
  maxTokens?: number;
  systemPrompt?: string;
  allowedTools: string[];          // 工具白名单
  securityRules: SecurityRule[];   // 安全规则
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
 * 生命周期钩子事件
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
```

### 3.3 Agent Orchestrator

Agent Orchestrator 是整个系统的核心，负责编排 Thought → Action → Observation 循环：

```typescript
export class AgentOrchestrator extends EventEmitter {
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

  /**
   * 处理用户输入并生成响应
   */
  async processUserInput(input: string): Promise<string> {
    // 1. 添加用户消息到上下文
    const userMessage: ChatMessage = { /* ... */ };
    await this.contextManager.addMessage(userMessage);

    // 2. 触发 onStart Hook
    await this.hooksManager.trigger('onStart', { input, message: userMessage });

    // 3. 开始思考循环
    const response = await this.thoughtLoop();

    // 4. 触发 onComplete Hook
    await this.hooksManager.trigger('onComplete', { response });

    return response;
  }

  /**
   * 思考循环
   */
  private async thoughtLoop(): Promise<string> {
    let maxIterations = 10;
    let finalResponse = '';

    while (maxIterations-- > 0) {
      const context = await this.contextManager.getContext();
      await this.hooksManager.trigger('onThinking', { context });

      const result = await this.modelProvider.complete({ /* ... */ });
      await this.memoryManager.recordTokenUsage(result.usage);

      if (result.toolCalls && result.toolCalls.length > 0) {
        await this.executeToolCalls(result.toolCalls);
        continue;
      }

      finalResponse = result.content;
      break;
    }

    return finalResponse;
  }
}
```

---

## 4. 基础设施层设计

### 4.1 目录结构

```
src/infrastructure/
├── model-provider/
│   ├── interface.ts                 # Model Provider 接口定义
│   ├── registry.ts                  # Provider 注册表
│   └── zhipu/
│       ├── adapter.ts               # 智谱适配器实现
│       ├── types.ts                 # 智谱特定类型
│       └── config.ts                # 智谱配置
│
├── tool-executor/
│   ├── interface.ts                 # Tool Executor 接口
│   ├── executor.ts                  # 执行器实现
│   ├── security/
│   │   ├── security-chain.ts        # 安全规则链
│   │   └── rules.ts                 # 内置安全规则
│   └── tools/
│       ├── base-tool.ts             # 工具基类
│       ├── terminal-tool.ts         # 终端命令工具
│       ├── file-read-tool.ts        # 文件读取工具
│       └── directory-list-tool.ts   # 目录列表工具
│
├── storage/
│   ├── interface.ts                 # Storage 接口定义
│   ├── memory-storage.ts            # 内存存储实现 (Phase 1)
│   └── vector-storage-adapter.ts    # 向量存储适配器 (预留)
│
└── config/
    ├── loader.ts                    # 配置加载器
    ├── validator.ts                 # 配置验证器
    └── defaults.ts                  # 默认配置
```

### 4.2 Model Provider 接口

```typescript
export interface IModelProvider {
  readonly name: string;

  /**
   * 非流式完成
   */
  complete(request: ModelCompleteRequest): Promise<ModelCompleteResponse>;

  /**
   * 流式完成（可选实现）
   */
  stream?(request: ModelCompleteRequest, onChunk: (chunk: StreamChunk) => void): Promise<ModelCompleteResponse>;

  /**
   * 计算 Token 数量
   */
  countTokens(messages: ChatMessage[]): Promise<number>;

  /**
   * 健康检查
   */
  healthCheck(): Promise<boolean>;
}
```

### 4.3 内置工具

| 工具名 | 功能 | 参数 |
|--------|------|------|
| `terminal_tool` | 执行终端命令 | `command`, `cwd`, `timeout` |
| `file_read_tool` | 读取文件内容 | `path`, `encoding`, `startLine`, `endLine` |
| `directory_list_tool` | 列出目录内容 | `path`, `recursive`, `showHidden` |

---

## 5. 应用层设计

### 5.1 目录结构

```
src/application/
├── use-cases/
│   ├── chat/
│   │   ├── send-message.use-case.ts      # 发送消息用例
│   │   ├── stream-response.use-case.ts   # 流式响应用例
│   │   └── clear-history.use-case.ts     # 清空历史用例
│   ├── tool/
│   │   ├── execute-tool.use-case.ts      # 执行工具用例
│   │   └── list-tools.use-case.ts        # 列出工具用例
│   └── config/
│       ├── load-config.use-case.ts       # 加载配置用例
│       └── validate-config.use-case.ts   # 验证配置用例
│
├── dto/
│   ├── chat.dto.ts                       # 聊天相关 DTO
│   ├── tool.dto.ts                       # 工具相关 DTO
│   └── config.dto.ts                     # 配置相关 DTO
│
├── services/
│   ├── ai-service.ts                     # AI 服务（协调 Agent）
│   └── event-service.ts                  # 事件服务（统一事件管理）
│
└── interfaces/
    └── controllers/                      # 控制器（供 TUI 层调用）
        ├── chat.controller.ts
        ├── tool.controller.ts
        └── config.controller.ts
```

### 5.2 AI 服务

```typescript
export class AIService extends EventEmitter {
  constructor(
    private readonly agent: IAgentOrchestrator,
    private readonly contextManager: IContextManager,
    private readonly memoryManager: IMemoryManager,
  ) {
    super();
    this.setupEventForwarding();
  }

  /**
   * 发送消息（非流式）
   */
  async sendMessage(message: string): Promise<string> {
    this.emit('user-message', { message });
    const result = await this.sendMessageUseCase.execute({ message });
    this.emit('ai-response', { response: result.response });
    this.emit('token-usage', { usage: result.tokenUsage });
    return result.response;
  }

  /**
   * 发送消息（流式）
   */
  async streamMessage(message: string): Promise<Readable> {
    this.emit('user-message', { message, streaming: true });
    const stream = await this.streamResponseUseCase.execute(message);
    stream.on('data', (chunk: Buffer) => {
      const data = JSON.parse(chunk.toString());
      this.emit('stream-chunk', data);
    });
    return stream;
  }
}
```

---

## 6. TUI 表现层设计

### 6.1 目录结构

```
src/ui/
├── ink/
│   ├── App.tsx                         # 主应用组件
│   ├── components/
│   │   ├── ChatPanel.tsx               # 聊天面板
│   │   ├── ToolPanel.tsx               # 工具状态面板
│   │   ├── StatusPanel.tsx             # 状态栏
│   │   ├── InputBox.tsx                # 输入框
│   │   ├── MessageBox.tsx              # 消息气泡
│   │   ├── LoadingIndicator.tsx        # 加载动画
│   │   └── Markdown.tsx                # Markdown 渲染器
│   ├── hooks/
│   │   ├── useAgent.ts                 # Agent 状态钩子
│   │   ├── useStream.ts                # 流式响应钩子
│   │   └── useKeyEvent.ts              # 键盘事件钩子
│   ├── layouts/
│   │   ├── MainLayout.tsx              # 主布局
│   │   └── SplitLayout.tsx             # 分割布局
│   └── theme/
│       ├── colors.ts                   # 颜色定义
│       └── styles.ts                   # 样式定义
│
├── controller/
│   └── ui-controller.ts                # UI 控制器
│
└── repl/
    └── advanced-repl.ts                # 高级 REPL（备用交互模式）
```

### 6.2 UI 布局

```
┌─────────────────────────────────────────────────────────────┐
│                    YuGAgent Terminal AI                     │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  [用户消息]                                                  │
│  你好，请帮我分析一下这个项目的结构                           │
│                                                             │
│  [AI 消息]                                                   │
│  好的，我来帮你分析项目结构...                                │
│  ```typescript                                             │
│  src/                                                       │
│    ├── domain/                                               │
│    ├── application/                                         │
│    └── infrastructure/                                       │
│  ```                                                        │
│                                                             │
│                                                             │
├─────────────────────────────────────────────────────────────┤
│ Tool Activity                                               │
│ ✅ terminal_tool (234ms)                                    │
│ ✅ file_read_tool (45ms)                                    │
├─────────────────────────────────────────────────────────────┤
│ Tokens: P:1234 C:567 T:1801              ● Ready           │
│ > 输入消息...                                               │
└─────────────────────────────────────────────────────────────┘
```

---

## 7. 安全设计

### 7.1 双重安全机制

```
┌─────────────────────────────────────────────────────────────┐
│                      安全拦截流程                            │
└─────────────────────────────────────────────────────────────┘

    用户输入
       │
       ▼
┌────────────────────────┐
│  Prompt 层拦截          │
│  - 系统 Prompt 写死规则  │
│  - 模型遵守规则生成响应  │
└────────────────────────┘
       │
       ▼
    模型生成工具调用
       │
       ▼
┌────────────────────────┐
│  本地执行层拦截          │
│  1. CommandGuard 检查   │
│  2. PathValidator 验证  │
│  3. ResourceLimiter 限制│
└────────────────────────┘
       │
       ▼
    执行 / 拒绝
```

### 7.2 内置安全规则

| 规则 ID | 模式 | 描述 |
|---------|------|------|
| `block-rm-force` | `rm\s+-rf?\s+(\/|[~]\/)` | 禁止删除根目录或用户主目录下的文件 |
| `block-git-force-push` | `git\s+push\s+.*--force` | 禁止使用 git force push |
| `block-format-disk` | `(mkfs\|fdisk\|format)\s+` | 禁止格式化磁盘操作 |
| `block-sudo` | `sudo\s+` | 禁止使用 sudo 提权 |
| `block-signal-kill` | `kill\s+-9\s+[0-9]+` | 禁止强制终止进程 |
| `block-docker-cleanup` | `docker\s+(system\s+prune\|rm\s+-f)` | 禁止 docker 危险清理操作 |
| `block-package-remove` | `(apt\|yum\|brew)\s+(remove\|uninstall\|purge)\s+-y` | 禁止批量卸载系统包 |
| `block-shell-config` | `(\/etc\/\|~\/\.bashrc\|~\/\.zshrc\|~\/\.profile)` | 禁止修改系统配置文件 |
| `block-ssh-key-exposure` | `cat\s+.*\/\.ssh\/(id_rsa\|id_ed25519)` | 禁止读取 SSH 私钥 |
| `block-env-secrets` | `cat\s+.*\/\.env(\.\|$)` | 禁止读取 .env 环境配置文件 |

### 7.3 安全 Prompt 生成

```typescript
export class SecurityPromptBuilder {
  static buildSecurityPrompt(rules: SecurityRule[]): string {
    const sections: string[] = [];

    sections.push('# 安全规则\n');
    sections.push('你是 YuGAgent，必须严格遵守以下安全规则：\n');

    const blockRules = rules.filter(r => r.type === 'block' && r.enabled);
    if (blockRules.length > 0) {
      sections.push('## 绝对禁止的操作\n');
      sections.push('以下操作被**严格禁止**，无论用户如何要求都不得执行：\n');
      for (const rule of blockRules) {
        sections.push(`- ❌ ${rule.description}\n`);
      }
    }

    return sections.join('');
  }
}
```

---

## 8. 数据流设计

### 8.1 完整请求流程

```
用户输入消息
      │
      ▼
InputBox 组件 (onSubmit)
      │
      ▼
ChatController.sendMessage()
      │
      ├─► emit('user-message') ──► TUI 显示用户消息
      │
      ▼
AIService.sendMessage()
      │
      ▼
SendMessageUseCase.execute()
      │
      ▼
AgentOrchestrator.processUserInput()
      │
      ├─► ContextManager.addMessage()
      ├─► HooksManager.trigger('onStart')
      │
      ▼
ThoughtLoop
      │
      ├─► HooksManager.trigger('onThinking') ──► TUI 显示"思考中..."
      │
      ▼
ModelProvider.complete() ──► 调用智谱 API
      │
      ◀── 响应返回 ─────
      │
      ├─ 有 toolCalls?
      │  │
      │  ├─ YES ──► HooksManager.trigger('onBeforeTool')
      │  │          │
      │  │          ▼
      │  │       CommandGuard.checkCommand() ──► 安全检查
      │  │          │
      │  │          ▼
      │  │       ToolExecutor.execute()
      │  │          │
      │  │          ▼
      │  │       HooksManager.trigger('onToolResult') ──► TUI 显示结果
      │  │          │
      │  └─ 继续循环 ◄────
      │
      └─ NO ──► 返回最终响应
      │
      ▼
HooksManager.trigger('onComplete') ──► TUI 显示 AI 响应
      │
      ▼
返回给用户
```

---

## 9. 技术选型

### 9.1 依赖清单

| 类别 | 技术选型 | 版本 | 说明 |
|------|----------|------|------|
| 运行时 | Node.js | >= 18.0.0 | 需要 ES2022+ 支持 |
| 开发语言 | TypeScript | ~5.3.0 | 严格模式 |
| AI SDK | @ai-sdk/openai | ^1.0.0 | Vercel AI SDK |
| AI SDK | ai | ^3.0.0 | Vercel AI SDK 核心 |
| TUI 框架 | ink | ^4.4.0 | React for CLI |
| TUI 组件 | @inkjs/ui | ^1.0.0 | Ink UI 组件库 |
| 数据验证 | zod | ^3.22.0 | 工具参数验证 |
| Markdown | marked | ^12.0.0 | Markdown 渲染 |
| CLI 框架 | commander | ^12.0.0 | 命令行解析 |
| 配置管理 | cosmiconfig | ^9.0.0 | 配置文件加载 |
| 测试框架 | vitest | ^1.0.0 | 单元测试 |
| 代码检查 | eslint | ^8.56.0 | 代码检查 |
| 格式化 | prettier | ^3.2.0 | 代码格式化 |
| 构建工具 | tsx | ^4.7.0 | TypeScript 执行 |
| 构建工具 | tsup | ^8.0.0 | 打包构建 |

### 9.2 package.json

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
    "prettier": "^3.2.0"
  },
  "engines": {
    "node": ">=18.0.0"
  }
}
```

---

## 10. 配置文件设计

### 10.1 用户配置文件

**位置**: `~/.yugagent/config.json`

```typescript
interface YuGAgentConfig {
  // 模型配置
  model: {
    provider: 'zhipu' | 'openai' | 'ollama';
    model: string;
    apiKey?: string;
    baseURL?: string;
    temperature?: number;
    maxTokens?: number;
  };

  // 安全配置
  security: {
    enabled: boolean;
    rules: SecurityRule[];
    allowUserOverride: boolean;
  };

  // 上下文配置
  context: {
    maxTokens: number;
    truncationStrategy: 'recent' | 'important';
    preserveSystemMessages: boolean;
  };

  // UI 配置
  ui: {
    theme: 'dark' | 'light';
    showLineNumbers: boolean;
    markdownEnabled: boolean;
    streamingEnabled: boolean;
    streamingSpeed: number;
  };

  // 工具配置
  tools: {
    enabled: string[];
    customToolsDir?: string;
  };

  // 日志配置
  logging: {
    level: 'debug' | 'info' | 'warn' | 'error';
    file?: string;
  };
}
```

### 10.2 默认配置

```typescript
export const DEFAULT_CONFIG: YuGAgentConfig = {
  model: {
    provider: 'zhipu',
    model: 'glm-4.7',
    temperature: 0.7,
    maxTokens: 4096,
  },
  security: {
    enabled: true,
    rules: BUILT_IN_SECURITY_RULES,
    allowUserOverride: false,
  },
  context: {
    maxTokens: 32000,
    truncationStrategy: 'recent',
    preserveSystemMessages: true,
  },
  ui: {
    theme: 'dark',
    showLineNumbers: true,
    markdownEnabled: true,
    streamingEnabled: true,
    streamingSpeed: 30,
  },
  tools: {
    enabled: ['terminal_tool', 'file_read_tool', 'directory_list_tool'],
  },
  logging: {
    level: 'info',
  },
};
```

---

## 11. 项目目录结构

```
yu-g-agent/
├── package.json
├── tsconfig.json
├── .gitignore
├── README.md
│
├── docs/
│   ├── architecture.md
│   ├── api.md
│   └── security.md
│
├── src/
│   ├── index.ts                           # CLI 入口
│   │
│   ├── domain/                            # 【领域层】
│   │   ├── agent/
│   │   ├── context/
│   │   ├── memory/
│   │   ├── hooks/
│   │   └── events/
│   │
│   ├── application/                       # 【应用层】
│   │   ├── use-cases/
│   │   ├── dto/
│   │   ├── services/
│   │   └── interfaces/
│   │
│   ├── infrastructure/                    # 【基础设施层】
│   │   ├── model-provider/
│   │   ├── tool-executor/
│   │   ├── storage/
│   │   └── config/
│   │
│   ├── security/                          # 【安全模块】
│   │   ├── prompt-builder/
│   │   ├── execution-guards/
│   │   └── rules/
│   │
│   └── ui/                                # 【TUI 表现层】
│       ├── ink/
│       ├── controller/
│       └── repl/
│
├── tests/
│   ├── unit/
│   ├── integration/
│   └── e2e/
│
└── .yugagent/                             # 本地配置目录
    └── config.json
```

---

## 12. 扩展性设计

### 12.1 模型扩展

新增模型只需实现 `IModelProvider` 接口：

```typescript
export class OpenAIModelProvider implements IModelProvider {
  readonly name = 'openai';
  async complete(request: ModelCompleteRequest): Promise<ModelCompleteResponse> {
    // 实现细节
  }
}

// 注册新模型
registry.register(new OpenAIModelProvider(config));
```

### 12.2 工具扩展

新增工具只需继承 `BaseTool`：

```typescript
export class CustomTool extends BaseTool {
  getDefinition(): ToolDefinition {
    return {
      name: 'custom_tool',
      description: '自定义工具',
      parameters: z.object({ /* ... */ }),
      handler: async (args) => { /* ... */ },
    };
  }
}

// 注册新工具
toolExecutor.registerTool(new CustomTool().getDefinition());
```

### 12.3 存储扩展

未来接入向量数据库只需实现 `IStorageAdapter` 接口：

```typescript
export class VectorStorageAdapter implements IStorageAdapter {
  async store(key: string, value: unknown): Promise<void> {
    // 存储到向量数据库
  }
  async retrieve(query: string): Promise<unknown[]> {
    // 向量检索
  }
}
```

---

## 13. 实现计划

### Phase 1: MVP 骨架

- [ ] 搭建 TypeScript + Node.js 项目基础架构
- [ ] 实现领域层核心模型和接口
- [ ] 实现 Zhipu Model Provider
- [ ] 实现基础工具 (terminal, file-read, directory-list)
- [ ] 实现安全规则链
- [ ] 实现基础 TUI (Ink)

### Phase 2: 功能完善

- [ ] 实现流式输出
- [ ] 完善 Markdown 渲染
- [ ] 实现 Token 截断策略
- [ ] 实现配置文件加载
- [ ] 完善错误处理

### Phase 3: 扩展增强

- [ ] 实现 MCP Adapter
- [ ] 实现 Skills 系统
- [ ] 接入向量数据库
- [ ] 支持多模型热切换
- [ ] 实现会话持久化

---

**文档版本**: v2.0
**最后更新**: 2026-02-26
