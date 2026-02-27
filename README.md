# YuGAgent

现代化多模型终端 AI 助手 - 类似 Claude Code / OpenCode 的高阶终端 AI 助理。

## 特性

- **本地优先**：基于 Node.js 构建，天然契合前端/全栈开发者的本地生态
- **多模型支持**：统一路由架构，支持零成本切换大模型（云端/本地）
- **工具驱动**：Agentic 原生设计，通过工具调用实现动态上下文策略
- **终端 TUI**：基于 Ink 的现代化终端用户界面
- **安全可控**：内置安全链，支持命令执行前的安全验证
- **会话管理**：智能 Token 计数与会话历史管理

## 安装

### 前置要求

- Node.js >= 18.0.0
- npm 或 yarn 或 pnpm

### 从源码安装

```bash
# 克隆仓库
git clone https://github.com/yourusername/yu-g-agent.git
cd yu-g-agent

# 安装依赖
npm install

# 构建项目
npm run build

# 全局安装（可选）
npm link
```

## 配置

### 环境变量

复制 `.env.example` 到 `.env` 并填入你的配置：

```bash
cp .env.example .env
```

编辑 `.env` 文件，设置智谱 AI 的 API Key：

```env
ZHIPU_API_KEY=your_api_key_here
```

### 环境变量说明

| 变量 | 必需 | 默认值 | 说明 |
|------|------|--------|------|
| `ZHIPU_API_KEY` | 是 | - | 智谱 AI API Key |
| `ZHIPU_MODEL` | 否 | `glm-4.7` | 使用的模型名称 |
| `ZHIPU_BASE_URL` | 否 | `https://open.bigmodel.cn/api/paas/v4` | API 基础 URL |
| `ZHIPU_TIMEOUT` | 否 | `60000` | 请求超时时间（毫秒） |
| `ZHIPU_MAX_RETRIES` | 否 | `3` | 最大重试次数 |

## 使用方法

### 命令行接口

YuGAgent 提供了三个主要命令：

#### 1. chat - 启动交互式聊天

启动 TUI 交互界面：

```bash
yugagent chat
```

或从源码运行：

```bash
npm run dev chat
```

#### 2. ask - 直接提问

发送单个问题并获取回复：

```bash
yugagent ask "你的问题"
```

选项：
- `-m, --model <model>`：指定模型名称（默认：glm-4.7）
- `-t, --temperature <temp>`：设置温度 0-1（默认：0.7）
- `--json`：以 JSON 格式输出

示例：

```bash
# 使用自定义模型
yugagent ask "解释 React Hooks" -m glm-4.7

# JSON 格式输出
yugagent ask "分析这个代码" --json
```

#### 3. status - 查看状态

显示当前配置和状态：

```bash
yugagent status
```

## 开发

### 项目结构

```
src/
├── index.ts                 # CLI 入口点
├── di/                      # 依赖注入
│   └── container.ts         # 应用容器
├── domain/                  # 领域层
│   ├── agent/              # Agent 核心逻辑
│   ├── context/            # 上下文管理
│   ├── memory/             # 会话记忆管理
│   ├── hooks/              # 生命周期钩子
│   └── events/             # 事件类型定义
├── infrastructure/          # 基础设施层
│   ├── model-provider/     # 模型提供者
│   │   └── zhipu/          # 智谱 AI 适配器
│   └── tool-executor/      # 工具执行器
│       ├── security/       # 安全链
│       └── tools/          # 原生工具
├── application/             # 应用层
│   ├── services/           # 应用服务
│   ├── dto/                # 数据传输对象
│   └── interfaces/         # 控制器接口
└── ui/                      # UI 层
    └── ink/                # Ink TUI 组件
```

### 可用脚本

```bash
# 开发模式（监听文件变化）
npm run dev

# 构建
npm run build

# 启动构建后的应用
npm start

# 运行测试
npm test

# 代码检查
npm run lint

# 代码格式化
npm run format
```

### 架构设计

YuGAgent 采用事件驱动 + 中间件洋葱模型设计：

```
[ 终端 TUI 表现层 ] -- 监听 Hooks 事件重绘界面
       |
       | (用户自然语言输入)
       v
[ 核心调度层 Agent Core ]
       | [ Hooks Manager (生命周期拦截器) ]
       |
   [ Context / Memory (会话状态与 Token 截断管理) ]
       | [ Skill Router (技能路由) ]
       |
       v
[ Vercel AI SDK (多模型网关) ] -- [ 智谱 GLM-4 ]
       |
       | (模型返回 Tool Calling 指令)
       v
[ 能力注册中心 Capabilities ]
   [ 原生 Tools ] [ MCP Client 层 ] [ Skills ]
```

## 内置工具

### 1. run_command

执行无交互的 Bash/Shell 命令：

```typescript
{
  name: "run_command",
  description: "执行终端命令并返回输出",
  parameters: {
    command: "ls -la",
    timeout: 30000
  }
}
```

### 2. read_file

读取文件内容：

```typescript
{
  name: "read_file",
  description: "读取指定文件的内容",
  parameters: {
    file_path: "/path/to/file.ts"
  }
}
```

### 3. list_directory

查看目录结构：

```typescript
{
  name: "list_directory",
  description: "列出指定目录下的文件和子目录",
  parameters: {
    path: "/path/to/directory"
  }
}
```

## 路线图

### Phase 1: 骨架跑通 (MVP) - 当前阶段

- [x] TypeScript + Node.js 项目基础架构
- [x] Vercel AI SDK 桥接智谱 API
- [x] Hooks 基础机制
- [x] 基础工具实现
- [x] 基础 TUI 界面

### Phase 2: 安全与体验升级

- [ ] 流式输出渲染
- [ ] 敏感命令安全拦截
- [ ] Token 消耗统计与历史记录智能截断

### Phase 3: 架构完全体

- [ ] Skills 技能系统
- [ ] MCP Adapter 动态挂载
- [ ] 高级终端搜索工具
- [ ] Ink 完整 TUI 实现

## 贡献

欢迎提交 Issue 和 Pull Request！

## 许可证

MIT

## 相关资源

- [智谱 AI 开放平台](https://open.bigmodel.cn/)
- [Vercel AI SDK](https://sdk.vercel.ai/)
- [Ink - React for CLI](https://github.com/vadimdemedes/ink)
