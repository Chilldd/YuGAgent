# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 项目规范
1. 文档，注释等都必须使用中文
2. 重要的方法逻辑必须增加日志记录，使用不同的日志等级控制日志输出量
3. 方法逻辑复杂时，必须增加注释说明方法逻辑，注释风格为：
// step1. xxx
// step2. xxx
4. 方法必须有文档注释
5. 删除无用代码，没有使用的代码删除，除非留着扩展用（这种情况注释写清楚说明）
6. 修改完代码后，必须编译项目，编译通过并且没有报错才能结束任务
7. 禁止重复造轮子，先检查是否有可用的组件，有就直接用

## 常用命令

```bash
# 开发模式（监听文件变化并重新执行）
npm run dev -- <command>

# 构建
npm run build

# 运行构建后的应用
npm start

# 运行测试
npm test
npm run test -- tests/unit/agent-orchestrator.test.ts  # 运行单个测试文件

# 代码检查
npm run lint

# 代码格式化
npm run format
```

## CLI 命令

```bash
# 启动 TUI 交互式聊天
yugagent chat
npm run dev chat

# 直接提问（非交互模式）
yugagent ask "你的问题"
npm run dev ask "你的问题"

# 查看状态
yugagent status
npm run dev status
```

## 项目架构

YuGAgent 采用**分层洋葱架构（Clean Architecture + Event-Driven）**，包含四层：

```
┌─────────────────────────────────────────────────────────┐
│  UI Layer (Ink TUI)                                     │
│  - ChatPanel, StatusPanel, InputBox                     │
│  - 监听 Hooks 事件重绘界面                               │
├─────────────────────────────────────────────────────────┤
│  Application Layer                                      │
│  - AIService, ChatController                            │
│  - 用例编排，协调 Domain 层                              │
├─────────────────────────────────────────────────────────┤
│  Domain Layer (Core)                                    │
│  - AgentOrchestrator: 思考循环编排                      │
│  - HooksManager: 生命周期事件管理                        │
│  - ContextManager: 会话上下文与消息管理                  │
│  - MemoryManager: Token 计数与会话存储                   │
├─────────────────────────────────────────────────────────┤
│  Infrastructure Layer                                   │
│  - ModelProvider: 多模型适配器（智谱 GLM-4.7）          │
│  - ToolExecutor: 工具执行 + 安全规则链                   │
│  - Storage: 会话持久化（预留向量 DB 接口）               │
└─────────────────────────────────────────────────────────┘
```

### 数据流向

```
用户输入 → ChatController → AIService → AgentOrchestrator
                                                   │
                      Thought Loop (Think → Act → Observe)
                                                   │
                    ModelProvider ←→ ToolExecutor
                           │              │
                        智谱 API      安全规则链
```

## 核心组件说明

### AgentOrchestrator (src/domain/agent/orchestrator.ts)

核心编排器，实现 **Thought Loop**（思考循环）：
1. 接收用户输入 → 添加到上下文
2. 调用 ModelProvider 获取响应
3. 如果响应包含 toolCalls → 执行工具 → 继续循环
4. 如果无 toolCalls → 返回最终响应

最大思考迭代次数：`MAX_THOUGHT_ITERATIONS = 10`

### HooksManager (src/domain/hooks/manager.ts)

事件驱动系统的核心，管理生命周期钩子：

```typescript
// 注册钩子
hooksManager.on(HookEvent.START, async (ctx) => {
  console.log('Agent started:', ctx.sessionId);
}, { priority: 10 });

// 触发钩子
await hooksManager.emit(HookEvent.START, { sessionId, messages, data });
```

可用事件：`START`, `THINKING`, `BEFORE_TOOL`, `AFTER_TOOL`, `COMPLETE`, `ERROR`

### 依赖注入容器 (src/di/container.ts)

所有依赖通过 `createApp()` 函数注入：

```typescript
import { createApp } from './di/container.js';

const { agent, aiService, chatController, modelProvider } = createApp({
  systemPrompt: '自定义系统提示',
  allowedTools: ['terminal', 'file-read', 'directory-list'],
  maxThoughtIterations: 5,
});
```

### ModelProvider (src/infrastructure/model-provider/)

实现 `IModelProvider` 接口以支持新模型。当前实现：
- `ZhipuModelProvider`: 智谱 GLM-4.7

### ToolExecutor (src/infrastructure/tool-executor/)

工具执行器，内置安全规则链。内置工具：
- `terminal_tool`: 执行终端命令
- `file-read`: 读取文件内容
- `directory-list`: 列出目录内容

## 环境变量配置

必需的环境变量（创建 `.env` 文件）：

```env
ZHIPU_API_KEY=your_api_key_here
```

可选配置：
```env
ZHIPU_MODEL=glm-4.7
ZHIPU_BASE_URL=https://open.bigmodel.cn/api/paas/v4
ZHIPU_TIMEOUT=60000
ZHIPU_MAX_RETRIES=3
```

## 安全规则

内置安全规则位于 `src/infrastructure/tool-executor/security/rules.ts`，包括：
- 禁止 `rm -rf /` 等危险删除
- 禁止 `git push --force`
- 禁止 `sudo` 提权
- 禁止读取 SSH 私钥
- 禁止读取 `.env` 文件

## 扩展开发

### 添加新模型

1. 在 `src/infrastructure/model-provider/` 下创建新目录
2. 实现 `IModelProvider` 接口
3. 在 registry 中注册

### 添加新工具

1. 在 `src/infrastructure/tool-executor/tools/` 创建新文件
2. 继承工具基类或定义工具定义
3. 在 `createApp()` 的 `allowedTools` 中添加

### 添加新的 Hook

```typescript
// 在 AgentOrchestrator 中
hooksManager.on('customEvent', async (ctx) => {
  // 处理逻辑
});
```

## TypeScript 配置

- 目标：ES2022, Node.js 18+
- 模块：ESM
- JSX：react-jsx（用于 Ink TUI）

## 构建配置

使用 `tsup` 构建：
- 入口：`src/index.ts`
- 输出：`dist/`（ESM 格式）
- 不打包依赖（external）

## 测试

使用 `vitest`，测试文件位于 `tests/` 目录：
- 单元测试：`tests/unit/`
- 集成测试：`tests/integration/`
