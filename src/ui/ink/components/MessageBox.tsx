/**
 * @fileoverview Message bubble component for chat display
 * @module ui/ink/components/MessageBox
 */

import React from 'react';
import { Box, Text } from 'ink';
import { MessageRole } from '../../../domain/agent/types.js';
import { Markdown } from './Markdown.js';
import { themeStyles, colors } from '../theme/colors.js';

// 使用主题样式
const theme = themeStyles;

/**
 * Props for the MessageBox component
 */
export interface MessageBoxProps {
  /** The role of the message sender */
  role: MessageRole | 'user' | 'assistant' | 'system' | 'tool';
  /** Content of the message */
  content: string;
  /** Optional timestamp */
  timestamp?: Date;
  /** Optional tool name (for tool messages) */
  toolName?: string;
  /** Whether the tool execution was successful (for tool messages) */
  toolSuccess?: boolean;
  /** Maximum width for content wrapping */
  maxWidth?: number;
}

/**
 * Message bubble component with role-based styling
 */
export const MessageBox: React.FC<MessageBoxProps> = ({
  role,
  content,
  timestamp,
  toolName,
  toolSuccess,
  maxWidth = 80,
}) => {
  // Normalize role to match theme styles
  const normalizedRole = role === MessageRole.USER ? 'user'
    : role === MessageRole.ASSISTANT ? 'assistant'
      : role === MessageRole.TOOL ? 'tool'
        : 'system';

  const style = theme.messageBox[normalizedRole];

  return (
    <Box
      flexDirection="column"
      marginBottom={1}
      width={maxWidth}
      borderStyle="round"
      borderColor={style.border}
      paddingX={1}
    >
      {/* Header with role icon and optional timestamp */}
      <Box justifyContent="space-between">
        <Box>
          <Text bold color={style.border}>
            [{style.icon}]
          </Text>
          {toolName && (
            <Text dimColor> → {toolName}</Text>
          )}
          {toolSuccess !== undefined && (
            <Text color={toolSuccess ? colors.success : colors.error}>
              {' '}{toolSuccess ? '✓' : '✗'}
            </Text>
          )}
        </Box>
        {timestamp && (
          <Text dimColor>
            {formatTimestamp(timestamp)}
          </Text>
        )}
      </Box>

      {/* Content */}
      <Box marginTop={1}>
        {normalizedRole === 'tool' ? (
          <Text dimColor>{content}</Text>
        ) : (
          <Markdown content={content} maxWidth={maxWidth - 4} />
        )}
      </Box>
    </Box>
  );
};

/**
 * Props for the StreamMessage component (for streaming AI responses)
 */
export interface StreamMessageProps {
  /** Current streaming content */
  content: string;
  /** Whether still streaming */
  isStreaming: boolean;
  /** Maximum width for content wrapping */
  maxWidth?: number;
}

/**
 * Streaming message component with typing indicator
 */
export const StreamMessage: React.FC<StreamMessageProps> = ({ content, isStreaming, maxWidth = 80 }) => {
  const style = theme.messageBox.assistant;

  return (
    <Box
      flexDirection="column"
      marginBottom={1}
      width={maxWidth}
      borderStyle="round"
      borderColor={style.border}
      paddingX={1}
    >
      {/* Header */}
      <Box>
        <Text bold color={style.border}>
          [{style.icon}]
        </Text>
        {isStreaming && (
          <Text dimColor> typing</Text>
        )}
      </Box>

      {/* Content */}
      <Box marginTop={1}>
        <Markdown content={content} maxWidth={maxWidth - 4} />
      </Box>

      {/* Typing indicator */}
      {isStreaming && (
        <Text color={colors.info} dimColor>
          ▊
        </Text>
      )}
    </Box>
  );
};

/**
 * Format timestamp for display
 */
function formatTimestamp(date: Date): string {
  const hours = date.getHours().toString().padStart(2, '0');
  const minutes = date.getMinutes().toString().padStart(2, '0');
  const seconds = date.getSeconds().toString().padStart(2, '0');
  return `${hours}:${minutes}:${seconds}`;
}

export default MessageBox;
