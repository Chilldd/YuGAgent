/**
 * @fileoverview Chat panel component for displaying conversation history
 * @module ui/ink/components/ChatPanel
 */

import React, { useState, useEffect } from 'react';
import { Box, Static, Text } from 'ink';
import { MessageRole, ChatMessage } from '../../../domain/agent/types.js';
import { MessageBox, StreamMessage } from './MessageBox.js';
import { colors } from '../theme/colors.js';
import { CatLogo } from './CatLogo.js';
import { WelcomeInfo } from './WelcomeInfo.js';

/**
 * Props for the ChatPanel component
 */
export interface ChatPanelProps {
  /** Array of chat messages to display */
  messages: ChatMessage[];
  /** Current streaming content (if any) */
  streamingContent?: string;
  /** Whether currently streaming */
  isStreaming?: boolean;
  /** Maximum width for content wrapping */
  maxWidth?: number;
  /** Auto-scroll to bottom flag */
  autoScroll?: boolean;
}

/**
 * Chat panel component with message history display
 */
export const ChatPanel: React.FC<ChatPanelProps> = ({
  messages,
  streamingContent = '',
  isStreaming = false,
  maxWidth = 80,
  autoScroll = true,
}) => {
  // Track content updates for scrolling
  const [lastUpdate, setLastUpdate] = useState(Date.now());

  useEffect(() => {
    if (isStreaming || streamingContent) {
      // Trigger re-render for scrolling during streaming
      const interval = setInterval(() => {
        setLastUpdate(Date.now());
      }, 100);

      return () => clearInterval(interval);
    }
  }, [isStreaming, streamingContent]);

  // Filter out system messages - they should not be displayed to users
  const visibleMessages = messages.filter(msg => msg.role !== MessageRole.SYSTEM);

  return (
    <Box flexDirection="column" width={maxWidth}>
      {/* Message history using Static for non-scrolling content */}
      <Static items={visibleMessages}>
        {(message, index) => (
          <ChatMessageItem
            key={(message.metadata?.id as string | undefined) || index}
            message={message}
            maxWidth={maxWidth}
          />
        )}
      </Static>

      {/* Streaming content (if any) */}
      {isStreaming && streamingContent && (
        <StreamMessage
          content={streamingContent}
          isStreaming={isStreaming}
          maxWidth={maxWidth}
        />
      )}
    </Box>
  );
};

/**
 * Props for individual message item
 */
interface ChatMessageItemProps {
  message: ChatMessage;
  maxWidth: number;
}

/**
 * Individual chat message item
 */
const ChatMessageItem: React.FC<ChatMessageItemProps> = ({ message, maxWidth }) => {
  // Determine message content
  let content = message.content;
  let toolName: string | undefined;
  let toolSuccess: boolean | undefined;

  // Handle tool messages
  if (message.role === MessageRole.TOOL) {
    toolName = message.metadata?.toolName as string;
    toolSuccess = message.metadata?.success as boolean;
    content = content || (message.metadata?.output as string) || (message.metadata?.error as string) || '';
  }

  // Get timestamp from metadata
  const timestamp = message.metadata?.timestamp
    ? new Date(message.metadata.timestamp as string)
    : undefined;

  return (
    <MessageBox
      role={message.role}
      content={content}
      timestamp={timestamp}
      toolName={toolName}
      toolSuccess={toolSuccess}
      maxWidth={maxWidth}
    />
  );
};

/**
 * Props for the WelcomeMessage component
 */
export interface WelcomeMessageProps {
  /** Application name */
  appName?: string;
  /** Application version */
  version?: string;
  /** Model being used */
  model?: string;
  /** Session ID */
  sessionId?: string;
  /** Maximum width */
  maxWidth?: number;
}

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

/**
 * Props for the EmptyState component
 */
export interface EmptyStateProps {
  /** Message to display */
  message?: string;
  /** Maximum width */
  maxWidth?: number;
}

/**
 * Empty state shown when no messages
 */
export const EmptyState: React.FC<EmptyStateProps> = ({
  message = 'No messages yet. Start a conversation!',
  maxWidth = 80,
}) => {
  return (
    <Box
      flexDirection="column"
      justifyContent="center"
      alignItems="center"
      width={maxWidth}
      height={10}
    >
      <Text dimColor italic>
        {message}
      </Text>
    </Box>
  );
};

export default ChatPanel;
