/**
 * @fileoverview 欢迎界面信息展示组件
 * @module ui/ink/components/WelcomeInfo
 */

import React from 'react';
import { Box, Text } from 'ink';
import { colors } from '../theme/colors.js';

/**
 * WelcomeInfo 组件的属性接口
 */
export interface WelcomeInfoProps {
  /** 应用版本 */
  version?: string;
  /** 模型名称 */
  model?: string;
  /** 会话 ID */
  sessionId?: string;
  /** 响应式布局的最大宽度 */
  maxWidth?: number;
}

/**
 * WelcomeInfo 组件 - 显示应用信息和操作提示
 *
 * 根据终端宽度自动切换显示模式：
 * - maxWidth >= 60：显示完整版本（带分隔线、emoji 图标、完整信息）
 * - maxWidth < 60：显示紧凑版本（垂直排列，简化信息）
 *
 * @example
 * ```tsx
 * <WelcomeInfo
 *   version="2.0.0"
 *   model="glm-4.7"
 *   sessionId="abc123def456"
 *   maxWidth={80}
 * />
 * ```
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
