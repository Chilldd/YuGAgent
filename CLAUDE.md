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
