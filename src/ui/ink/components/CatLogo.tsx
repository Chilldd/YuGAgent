/**
 * @fileoverview 小猫 Logo 组件，用于欢迎界面
 * @module ui/ink/components/CatLogo
 */

import React from 'react';
import { Box, Text } from 'ink';
import { colors } from '../theme/colors.js';

/**
 * CatLogo 组件的属性接口
 */
export interface CatLogoProps {
  /** 响应式布局的最大宽度 */
  maxWidth?: number;
}

/**
 * CatLogo 组件 - 渲染赛博朋克风格的小猫 Logo 和 YuGAgent 文字
 *
 * 根据终端宽度自动切换显示模式：
 * - maxWidth >= 60：显示完整版本（小猫 ASCII 艺术 + YuGAgent 文字）
 * - maxWidth < 60：显示紧凑版本（仅 emoji + 文字）
 *
 * @example
 * ```tsx
 * <CatLogo maxWidth={80} />
 * ```
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
