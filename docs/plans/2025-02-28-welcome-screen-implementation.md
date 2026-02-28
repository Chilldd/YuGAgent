# 欢迎界面实现计划

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**目标:** 为 YuGAgent 的 TUI 界面实现赛博朋克风格的欢迎屏幕，包含小猫 Logo 和应用信息展示。

**架构:** 在现有 Ink TUI 框架基础上，新增两个组件（CatLogo、WelcomeInfo），重构 WelcomeMessage 主组件整合所有部分。使用 Ink 的 Text、Box 组件实现彩色 ASCII 艺术和响应式布局。

**技术栈:** Ink (React for CLI), TypeScript, 现有颜色主题系统

---

## Task 1: 创建 CatLogo 组件

**Files:**
- Create: `src/ui/ink/components/CatLogo.tsx`

**Step 1: 创建 CatLogo 组件文件**

创建文件 `src/ui/ink/components/CatLogo.tsx`，包含小猫 ASCII 艺术和 YuGAgent 文字。

```tsx
/**
 * @fileoverview 小猫 Logo 组件，用于欢迎界面
 * @module ui/ink/components/CatLogo
 */

import React from 'react';
import { Box, Text } from 'ink';
import { colors } from '../theme/colors.js';

/**
 * Props for the CatLogo component
 */
export interface CatLogoProps {
  /** Maximum width for responsive layout */
  maxWidth?: number;
}

/**
 * CatLogo 组件 - 渲染赛博朋克风格的小猫 Logo 和 YuGAgent 文字
 */
export const CatLogo: React.FC<CatLogoProps> = ({ maxWidth = 80 }) => {
  // 根据终端宽度决定是否显示完整版本
  const isCompact = maxWidth < 60;

  if (isCompact) {
    // 紧凑版本
    return (
      <Box flexDirection="column" alignItems="center" marginBottom={1}>
        <Text bold color={colors.primary}>
          🐱 YuGAgent
        </Text>
      </Box>
    );
  }

  // 完整版本 - 小猫 ASCII 艺术
  return (
    <Box flexDirection="column" alignItems="center" marginBottom={1}>
      {/* 猫耳朵 - 使用渐变色 */}
      <Box>
        <Text color={colors.primary}>
                    {'\u2571'}{'\u2572'}{'\u2571'}{'\u2572'}{'\u2571'}{'\u2572'}{'\u2571'}{'\u2572'}{'\u2571'}{'\u2572'}{'\u2571'}{'\u2572'}{'\u2571'}{'\u2572'}
        </Text>
      </Box>
      <Box>
        <Text color="#00F5FF">
                  {'\u2571'}{'\u2572'}{'\u2571'}{'\u2572'}{'\u2571'}{'\u2572'}{'\u2571'}{'\u2572'}{'\u2571'}{'\u2572'}{'\u2571'}{'\u2572'}{'\u2571'}{'\u2572'}{'\u2571'}{'\u2572'}{'\u2571'}{'\u2572'}
        </Text>
      </Box>

      {/* YuGAgent 文字 - 大号字体 */}
      <Box marginTop={1}>
        <Box>
          <Text bold color="#FF006E">                      </Text>
          <Text bold color="#FF006E">██╗    ██╗</Text>
          <Text bold color="#FF006E">                            </Text>
        </Box>
        <Box>
          <Text bold color="#FF006E">                      </Text>
          <Text bold color="#FF006E">██║    ██║</Text>
          <Text bold color="#FF006E">                            </Text>
        </Box>
        <Box>
          <Text bold color="#FF006E">                      </Text>
          <Text bold color="#FF006E">██║ █╗ ██║</Text>
          <Text bold color="#FF006E">                            </Text>
        </Box>
        <Box>
          <Text bold color="#FF006E">                      </Text>
          <Text bold color="#FF006E">██║███╗██║</Text>
          <Text bold color="#FF006E">                            </Text>
        </Box>
        <Box>
          <Text bold color="#FF006E">                      </Text>
          <Text bold color="#FF006E">╚███╔███╔╝</Text>
          <Text bold color="#FF006E">                            </Text>
        </Box>
        <Box>
          <Text bold color="#FF006E">                      </Text>
          <Text bold color="#FF006E"> ╚══╝╚══╝</Text>
          <Text bold color="#FF006E">                             </Text>
        </Box>
      </Box>

      {/* 装饰线 */}
      <Box marginTop={1}>
        <Text color="#FFBE0B">
                  ══════════════════
        </Text>
      </Box>

      {/* YuGAgent 文字 - 渐变色 */}
      <Box justifyContent="center">
        <Text bold color="#FFBE0B">                    </Text>
        <Text bold color="#FF006E">═</Text>
        <Text bold color="#00F5FF">═ YuGAgent </Text>
        <Text bold color="#FF006E">═</Text>
        <Text bold color="#FFBE0B">                         </Text>
      </Box>

      {/* 装饰线 */}
      <Box>
        <Text color="#FFBE0B">
                  ══════════════════
        </Text>
      </Box>
    </Box>
  );
};

export default CatLogo;
```

**Step 2: 运行编译检查**

Run: `npm run build`

Expected: 编译成功，无 TypeScript 错误

**Step 3: 提交**

```bash
git add src/ui/ink/components/CatLogo.tsx
git commit -m "feat: 添加 CatLogo 组件，渲染小猫 ASCII 艺术"
```

---

## Task 2: 创建 WelcomeInfo 组件

**Files:**
- Create: `src/ui/ink/components/WelcomeInfo.tsx`

**Step 1: 创建 WelcomeInfo 组件文件**

创建文件 `src/ui/ink/components/WelcomeInfo.tsx`，显示版本、模型、Session 信息。

```tsx
/**
 * @fileoverview 欢迎界面信息展示组件
 * @module ui/ink/components/WelcomeInfo
 */

import React from 'react';
import { Box, Text } from 'ink';
import { colors } from '../theme/colors.js';

/**
 * Props for the WelcomeInfo component
 */
export interface WelcomeInfoProps {
  /** Application version */
  version?: string;
  /** Model name */
  model?: string;
  /** Session ID */
  sessionId?: string;
  /** Maximum width for responsive layout */
  maxWidth?: number;
}

/**
 * WelcomeInfo 组件 - 显示应用信息和操作提示
 */
export const WelcomeInfo: React.FC<WelcomeInfoProps> = ({
  version = '2.0.0',
  model = 'unknown',
  sessionId,
  maxWidth = 80,
}) => {
  // 格式化 Session ID（只显示前 8 位）
  const displaySession = sessionId
    ? `${sessionId.slice(0, 8)}...`
    : 'N/A';

  // 根据宽度决定布局
  const isCompact = maxWidth < 60;

  if (isCompact) {
    // 紧凑版本 - 垂直排列
    return (
      <Box flexDirection="column" marginBottom={1}>
        <Box>
          <Text dimColor>Version: </Text>
          <Text color={colors.primary}>{version}</Text>
        </Box>
        {model && (
          <Box>
            <Text dimColor>Model: </Text>
            <Text color={colors.info}>{model}</Text>
          </Box>
        )}
      </Box>
    );
  }

  // 完整版本
  return (
    <Box flexDirection="column" marginBottom={1}>
      {/* 分隔线 */}
      <Box justifyContent="center" marginBottom={1}>
        <Text color={colors.gray[600]}>
  {'  '}━{'─'.repeat(Math.max(20, maxWidth - 20))}━{'  '}
        </Text>
      </Box>

      {/* 信息区域 */}
      <Box flexDirection="column" marginBottom={1}>
        {/* 第一行：Version 和 Model */}
        <Box justifyContent="center" marginBottom={1}>
          <Text>
            <Text dimColor>  🐱 Version:     </Text>
            <Text color={colors.primary} bold>{version}</Text>
            <Text dimColor>{'        '}</Text>
            <Text dimColor>🤖 Model:      </Text>
            <Text color={colors.info}>{model}</Text>
            <Text dimColor>          </Text>
          </Text>
        </Box>

        {/* 第二行：Session */}
        {sessionId && (
          <Box justifyContent="center" marginBottom={1}>
            <Text>
              <Text dimColor>  🔑 Session:    </Text>
              <Text color={colors.gray[400]}>{displaySession}</Text>
              <Text dimColor>{'                               '}</Text>
            </Text>
          </Box>
        )}
      </Box>

      {/* 分隔线 */}
      <Box justifyContent="center" marginBottom={1}>
        <Text color={colors.gray[600]}>
  {'  '}━{'─'.repeat(Math.max(20, maxWidth - 20))}━{'  '}
        </Text>
      </Box>

      {/* 操作提示 */}
      <Box justifyContent="center" marginBottom={1}>
        <Text>
          <Text dimColor>  💬 输入消息开始对话    </Text>
          <Text dimColor>⌨️  按 Ctrl+C 退出</Text>
          <Text dimColor>{'                 '}</Text>
        </Text>
      </Box>
    </Box>
  );
};

export default WelcomeInfo;
```

**Step 2: 运行编译检查**

Run: `npm run build`

Expected: 编译成功，无 TypeScript 错误

**Step 3: 提交**

```bash
git add src/ui/ink/components/WelcomeInfo.tsx
git commit -m "feat: 添加 WelcomeInfo 组件，显示应用信息"
```

---

## Task 3: 更新 ChatPanel 导出

**Files:**
- Modify: `src/ui/ink/components/ChatPanel.tsx`

**Step 1: 添加新组件导出**

在 `src/ui/ink/components/ChatPanel.tsx` 文件顶部添加新组件的导出。

找到这些行:
```tsx
import { MessageBox, StreamMessage } from './MessageBox.js';
import { colors } from '../theme/colors.js';
```

在它们后面添加:
```tsx
import { CatLogo } from './CatLogo.js';
import { WelcomeInfo } from './WelcomeInfo.js';
```

**Step 2: 重构 WelcomeMessage 组件**

替换现有的 `WelcomeMessage` 组件实现。

找到并替换 `WelcomeMessage` 组件 (约第 140-183 行):

```tsx
/**
 * Welcome message shown at start of session
 */
export const WelcomeMessage: React.FC<WelcomeMessageProps> = ({
  appName = 'YuGAgent',
  version = '2.0.0',
  model,
  sessionId,
  maxWidth = 80,
}) => {
  const isCompact = maxWidth < 60;

  if (isCompact) {
    // 紧凑版本
    return (
      <Box
        flexDirection="column"
        marginBottom={1}
        width={maxWidth}
        paddingX={1}
      >
        <CatLogo maxWidth={maxWidth} />
        <WelcomeInfo
          version={version}
          model={model}
          sessionId={sessionId}
          maxWidth={maxWidth}
        />
      </Box>
    );
  }

  // 完整版本 - 带边框
  return (
    <Box
      flexDirection="column"
      marginBottom={1}
      width={maxWidth}
      borderStyle="double"
      borderColor="#FF006E"
      paddingX={1}
    >
      {/* Logo 区域 */}
      <CatLogo maxWidth={maxWidth} />

      {/* 信息区域 */}
      <WelcomeInfo
        version={version}
        model={model}
        sessionId={sessionId}
        maxWidth={maxWidth}
      />
    </Box>
  );
};
```

**Step 3: 运行编译检查**

Run: `npm run build`

Expected: 编译成功，无 TypeScript 错误

**Step 4: 提交**

```bash
git add src/ui/ink/components/ChatPanel.tsx
git commit -m "refactor: 重构 WelcomeMessage 组件，整合 CatLogo 和 WelcomeInfo"
```

---

## Task 4: 测试欢迎界面显示

**Files:**
- Test: 启动 TUI 应用进行视觉测试

**Step 1: 启动应用测试**

Run: `npm run dev chat`

Expected:
1. 应用启动后显示欢迎界面
2. 小猫 Logo 清晰可见
3. 版本、模型、Session 信息正确显示
4. 按 Ctrl+C 可以正常退出

**Step 2: 测试响应式布局**

在不同终端宽度下测试:
- 宽终端 (>= 80 字符): 完整边框版本
- 中等终端 (60-80 字符): 简化版本
- 窄终端 (< 60 字符): 紧凑版本

**Step 3: 测试欢迎界面消失**

输入任意消息后，欢迎界面应该消失，显示对话内容。

**Step 4: 如果一切正常，提交**

```bash
git add -A
git commit -m "test: 验证欢迎界面功能正常"
```

---

## Task 5: 添加颜色主题常量（可选）

**Files:**
- Modify: `src/ui/ink/theme/colors.ts`

**Step 1: 检查现有颜色定义**

查看 `src/ui/ink/theme/colors.ts` 文件，确认是否需要添加赛博朋克配色常量。

如果需要，添加以下颜色常量:

```typescript
export const colors = {
  // ... 现有颜色

  // 赛博朋克配色
  cyberPink: '#FF006E',
  cyberCyan: '#00F5FF',
  cyberYellow: '#FFBE0B',
  // ...
};
```

**Step 2: 更新组件使用新颜色常量**

如果添加了常量，更新 `CatLogo.tsx` 和 `WelcomeInfo.tsx` 使用 `colors.cyberPink` 等常量替换硬编码颜色值。

**Step 3: 编译并测试**

Run: `npm run build`

**Step 4: 提交**

```bash
git add src/ui/ink/theme/colors.ts src/ui/ink/components/CatLogo.tsx src/ui/ink/components/WelcomeInfo.tsx
git commit -m "refactor: 使用颜色主题常量替换硬编码颜色"
```

---

## 验收检查清单

在完成所有任务后，验证以下内容:

- [ ] 小猫 Logo 清晰可识别
- [ ] 赛博朋克配色正确应用（粉红、青色、黄色）
- [ ] 版本、模型、Session 信息正确显示
- [ ] 响应式布局在不同终端宽度下正常显示
- [ ] 用户输入后欢迎界面自动消失
- [ ] 代码编译通过，无 TypeScript 错误
- [ ] 所有组件有完整的 JSDoc 注释
- [ ] 注释使用中文
