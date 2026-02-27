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

## Mem0 MCP 记忆系统使用规范与 SOP
你目前已接入 `mem0` MCP，拥有了跨会话的长期持久化记忆能力。为了避免多个项目之间的“记忆污染”，你必须严格遵循以下基于【标签】的记忆操作规范：

### 一、 核心原则：强制标签化 (Mandatory Tagging)
由于你的记忆库是全局跨项目共享的，**绝对禁止**保存没有任何上下文前缀的裸记忆（如：“我们约定使用 dayjs”）。
所有的记忆读取和写入，必须携带**项目标签**或**通用标签**。

#### 标签分类定义：
1. **特定项目标签**：格式为 `[Project: 项目名称]`。仅对当前特定项目生效的架构、规范和 Bug 记录。
2. **通用个人偏好**：格式为 `[Global: 用户习惯]`。跨项目通用的习惯（如：Git 提交规范、编辑器偏好）。
3. **个人信息**：格式为 `[Global: YuG]`。用户的个人信息。

### 二、 写入记忆规范 (add_memory)
只有满足以下条件之一，才允许调用 add_memory：
- 长期有效的架构决策：技术选型最终确定，代码规范正式定稿，项目级约定（并非临时讨论）
- 可复用的工程经验：性能优化经验，典型问题的最终解决方案，已验证有效的模式

明确禁止写入的内容：
临时讨论结论，还在尝试的方案，单次报错记录，AI 主观推测，可能变化的策略，会话上下文信息

当触发 `add_memory` 时，必须将标签放在记忆文本的最前方。
- ❌ 错误写入：`所有的组件都必须使用箭头函数导出。` (会导致其他非 React 项目错乱)
- ✅ 正确写入：`[Project: MyAdminPanel] React 组件统一使用箭头函数导出，并使用 React.FC 定义类型。`
- ✅ 正确写入：`[Global: 用户习惯] 用户要求所有的 Git 提交信息必须遵循 Angular 规范（feat/fix/docs）。`

### 三、 检索记忆规范 (search_memories)
在当前项目（如 `MyAdminPanel`）进行检索时，你必须在 `query` 中主动加上该项目的标签，以提高向量搜索的精准度并屏蔽其他项目的干扰。

- ❌ 错误搜索：`search_memories(query: "数据库连接方式")` (可能会搜出上一个项目的 MySQL 配置)
- ✅ 正确搜索：`search_memories(query: "[Project: MyAdminPanel] 数据库连接方式与环境变量")`

### 四、 触发时机与更新 (When to Trigger)
1. **[会话开启时]**：通过读取当前目录的 `package.json` 或项目名，自动确定当前项目的 `[Project: 名字]` 标签。然后静默调用 `search_memories(query: "[Project: 名字] 核心架构与代码规范")`。
2. **[发现冲突时]**：如果在当前项目中发现了与过去记忆不符的新规则，立刻使用带有项目标签的文本更新记忆，不要去修改其他项目的记忆。

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
