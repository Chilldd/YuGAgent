# 🚀 YuGAgent: 现代化多模型终端智能助手设计文档

## 1. 产品概述 (Product Overview)

### 1.1 产品背景
当前开发者在编码、调试、阅读源码时，需要在 IDE、终端和网页端 AI 聊天框之间频繁切换。本项目旨在开发一款类似 Claude Code / OpenCode 的高阶终端 AI 助理（CLI Agent）。它能直接运行在开发者的本地终端中，读取本地代码、执行系统命令，并通过多轮对话自主完成项目理解、环境排查甚至代码修改任务。

### 1.2 核心定位
*   **本地优先，高度扩展**：基于 Node.js 构建，天然契合前端/全栈开发者的本地生态。
*   **多模型统一路由**：允许用户零成本切换大模型（云端/本地），以应对不同复杂度的任务体系。
*   **Agentic 原生设计**：抛弃笨重的全量 RAG，采用“工具驱动（Tool-driven）”的动态上下文策略。

---

## 2. 技术栈选型 (Tech Stack)

*   **运行环境**：Node.js (>= 18)
*   **开发语言**：TypeScript (严格的类型校验保障 Agent 复杂状态不出错)
*   **核心 AI 引擎**：**Vercel AI SDK** (天然抹平不同大模型厂商 API 差异，原生支持 Tool Calling 和流式输出)
*   **终端 UI 交互层 (TUI)**：
    *   * **React for CLI**：引入 `Ink` 框架实现复杂的多窗口、动态状态重绘的 TUI 界面。
*   **数据验证**：`Zod` (定义强类型的工具入参规范)

---

## 3. 核心架构设计 (V2.0 扩展性架构)

系统采用 **“事件驱动 (Event-Driven) + 中间件洋葱模型”** 设计，实现 UI 表现层与核心调度引擎的完全解耦。

### 3.1 架构图

```text
[ 终端 TUI 表现层 (Ink / 高级 REPL) ] —— 监听 Hooks 事件重绘界面 (如：显示 Loading、渲染流式文本)
       |
       | (用户自然语言输入)
       v
========================== [ 核心调度层 Agent Core ] ==========================
       |[ Hooks Manager (生命周期拦截器) ] 
       | (触发: onStart -> onThinking -> onBeforeTool -> onToolResult)
       |
   [ Context / Memory (会话状态与 Token 截断管理) ]
       |[ Skill Router (技能路由) ] <--- 根据当前场景注入特定的 System Prompt 和工具白名单
       |
===============================================================================
       | 
       | (组装 Prompt + Allowed Tools)
       v[ Vercel AI SDK (多模型网关) ] ---->[ 智谱 GLM-4 (一期) / OpenAI / Ollama 等 ]
       |
       | (模型返回 Tool Calling 指令)
       v
==========================[ 能力注册中心 Capabilities ] =======================
       |
   [ 原生 Tools (原子工具) ][ MCP Client 层 (外挂拓展) ]      [ Skills (复合工作流) ]
   - 终端命令 (run_command)      - 动态连接外部 MCP Server       - Git 自动化处理
   - 文件读取 (read_file)        - 将 MCP 工具转换为 Zod 格式    - 错误日志排查
   - 目录查看 (list_dir)
===============================================================================
```

### 3.2 三大核心高阶特性说明
1.  **Hooks (生命周期钩子)**：允许系统在 Agent 运行的任何节点插入自定义逻辑。例如安全拦截（拦截高危 Shell 命令并弹窗确认）、UI 动态更新（终端原地展示工具执行进度）。
2.  **MCP (模型上下文协议)**：预留动态扩展接口，支持未来通过 WebSocket/Stdio 接入外部标准化服务（如本地数据库访问 MCP、GitHub API MCP），无需在主干代码中硬编码。
3.  **Skills (技能系统)**：将特定的“系统提示词 + 绑定的底层 Tools”打包成一个独立模块。例如开启 `GitExpert` 技能时，Agent 只能使用 git 相关的基础命令，防止大模型幻觉和乱发散。

---

## 4. MVP (最小可行性产品) 范围定义

为了快速跑通项目，V1.0 MVP 阶段将严格限制功能范围，专注打通底层骨架。

### 4.1 接入模型
*   **首发接入**：**智谱 AI (GLM-4.7)** (全面兼容 OpenAI 接口格式，国内直连速度快，Tool Calling 表现优秀)。

### 4.2 基础工具支持 (Base Tools)
*   **`run_command`**：执行无交互的 Bash/Shell 命令（如 `pwd`, `git status`, `npm run build`），并返回执行的 stdout/stderr 日志。
*   **`read_file`**：读取指定文件的全部或部分行内容。
*   **`list_directory`**：查看指定目录下的文件结构。

### 4.3 核心流程支持
1.  **全局配置**：读取 `~/.devagentrc` 中的 API Key 配置。
2.  **多轮对话**：在终端启动一个常驻进程，支持用户持续提问。
3.  **自主执行循环**：支持模型进行 `Thought(思考) -> Action(调用工具) -> Observation(获取输出) -> Output(总结回复)` 的完整闭环。

---

## 5. 项目结构与模块划分 (目录设计规范)

```text
src/
 ├── index.ts                 # CLI 入口点 (解析命令行参数，如 `devagent start`)
 ├── config.ts                # 读取与管理本地配置 (~/.devagentrc)
 │
 ├── ui/                      # 【UI 表现层】
 │    ├── repl.ts             # 负责多轮对话循环、流式打字机效果、终端 Markdown 渲染
 │    └── components/         # (如后续引入 Ink，存放相关的 React 组件)
 │
 ├── core/                    # 【核心引擎层】
 │    ├── agent.ts            # 组装 Vercel AI SDK，处理主流程
 │    ├── hooks.ts            # 生命周期 EventEmitter，解耦 UI 和业务
 │    └── session.ts          # 历史消息数组管理
 │
 ├── providers/               # 【模型提供方】
 │    ├── index.ts            # 暴露统一的对外方法
 │    └── zhipu.ts            # 智谱适配器 (基于 @ai-sdk/openai)
 │
 └── capabilities/            # 【扩展能力层】
      ├── tools/              # 原生基础工具集
      │    ├── terminal.ts    # run_command 的实现
      │    └── fs.ts          # read_file, list_dir 的实现
      ├── mcp/                # MCP 客户端接入逻辑 (预留)
      └── skills/             # 预设技能组 (预留)
```

---

## 6. 开发演进路线图 (Roadmap)

### 🔴 Phase 1: 骨架跑通 (MVP)
- [ ] 搭建 TypeScript + Node.js 项目基础架构。
- [ ] 引入 `Vercel AI SDK`，成功桥接智谱 API。
- [ ] 实现 `Hooks` 基础机制，跑通 `run_command` 和 `read_file` 两个工具。
- [ ] 实现基础的 TUI (通过 `readline` + 基础样式库)，跑通第一场多轮对话。

### 🟡 Phase 2: 安全与体验升级
- [ ] 引入流式输出 (Streaming) 并在终端中美观地渲染 Markdown。
-[ ] **安全升级**：在 Hooks 层拦截 `rm`, `push` 等敏感命令，加入用户 `[Y/n]` 授权拦截。
- [ ] 加入 Token 消耗统计与历史记录智能截断。

### 🟢 Phase 3: 架构完全体 (MCP & Skills)
- [ ] 实现 `Skills` 概念，支持通过命令（如 `/skill git`）动态切换不同场景的能力集。
- [ ] 实现 `MCP Adapter`，支持动态挂载本地启动的外部 MCP 工具。
- [ ] 引入高级终端搜索工具 (如利用 `ripgrep` 实现 `search_code`)，实现“动态 Agentic RAG”。
- [ ] (可选) 使用 `Ink` 重构底层 UI 库，实现类似 OpenCode 的极客范 TUI。

---

> **下一步行动项**：文档确认无误后，即可开始执行 **Phase 1**，初始化项目并编写基础的核心 Agent 调用代码及工具包装。