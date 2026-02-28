/**
 * @fileoverview Status panel component for displaying agent state
 * @module ui/ink/components/StatusPanel
 */

import React from 'react';
import { Box, Text } from 'ink';
import { ServiceStatus } from '../../../application/dto/chat.dto.js';
import { TokenUsage } from '../../../domain/agent/types.js';
import { colors } from '../theme/colors.js';

/**
 * Props for the StatusPanel component
 */
export interface StatusPanelProps {
  /** Current service status */
  status: ServiceStatus;
  /** Token usage statistics */
  tokenUsage?: TokenUsage;
  /** Current model name */
  model?: string;
  /** Session ID */
  sessionId?: string;
  /** Current processing state message */
  processingMessage?: string;
  /** Maximum width */
  maxWidth?: number;
}

/**
 * Status indicator style
 */
interface StatusStyle {
  color: string;
  icon: string;
  label: string;
}

/**
 * Get status style based on service status
 */
function getStatusStyle(status: ServiceStatus): StatusStyle {
  switch (status) {
    case ServiceStatus.IDLE:
      return { color: colors.success, icon: '●', label: 'Ready' };
    case ServiceStatus.PROCESSING:
      return { color: colors.info, icon: '◐', label: 'Processing' };
    case ServiceStatus.ERROR:
      return { color: colors.error, icon: '●', label: 'Error' };
    case ServiceStatus.INITIALIZING:
      return { color: colors.warning, icon: '○', label: 'Initializing' };
    case ServiceStatus.SHUTTING_DOWN:
      return { color: colors.warning, icon: '◒', label: 'Shutting down' };
    case ServiceStatus.STOPPED:
      return { color: colors.gray[500], icon: '○', label: 'Stopped' };
    default:
      return { color: colors.gray[500], icon: '○', label: 'Unknown' };
  }
}

/**
 * Status panel component
 */
export const StatusPanel: React.FC<StatusPanelProps> = ({
  status,
  tokenUsage,
  model,
  sessionId,
  processingMessage,
  maxWidth = 80,
}) => {
  const statusStyle = getStatusStyle(status);

  return (
    <Box
      flexDirection="column"
      width={maxWidth}
      borderStyle="single"
      borderColor={colors.gray[700]}
      paddingX={1}
    >
      {/* Status bar */}
      <Box justifyContent="space-between" width={maxWidth - 4}>
        <Box>
          <Text color={statusStyle.color} bold>
            {statusStyle.icon} {statusStyle.label}
          </Text>
          {processingMessage && (
            <>
              <Text dimColor>: </Text>
              <Text dimColor italic>{processingMessage}</Text>
            </>
          )}
        </Box>

        {/* Model indicator */}
        {model && (
          <Text dimColor>
            [{model}]
          </Text>
        )}
      </Box>

      {/* Token usage (if available) */}
      {tokenUsage && (tokenUsage.totalTokens > 0 || status === ServiceStatus.PROCESSING) && (
        <Box justifyContent="space-between" width={maxWidth - 4} marginTop={1}>
          <TokenUsageDisplay tokenUsage={tokenUsage} />
        </Box>
      )}

      {/* Session ID (truncated) */}
      {sessionId && (
        <Box marginTop={1}>
          <Text dimColor>
            Session: <Text color={colors.gray[400]}>{sessionId.slice(0, 12)}{sessionId.length > 12 ? '...' : ''}</Text>
          </Text>
        </Box>
      )}
    </Box>
  );
};

/**
 * Props for token usage display
 */
interface TokenUsageDisplayProps {
  tokenUsage: TokenUsage;
}

/**
 * Token usage display component
 */
const TokenUsageDisplay: React.FC<TokenUsageDisplayProps> = ({ tokenUsage }) => {
  return (
    <>
      <Text dimColor>
        Tokens: <Text color={colors.info}>{tokenUsage.promptTokens}</Text>
        {' + '}
        <Text color={colors.success}>{tokenUsage.completionTokens}</Text>
        {' = '}
        <Text bold color={colors.warning}>{tokenUsage.totalTokens}</Text>
      </Text>
    </>
  );
};

/**
 * Props for the StatusIndicator component (compact version)
 */
export interface StatusIndicatorProps {
  /** Current service status */
  status: ServiceStatus;
  /** Optional custom message */
  message?: string;
}

/**
 * Compact status indicator for inline use
 */
export const StatusIndicator: React.FC<StatusIndicatorProps> = ({ status, message }) => {
  const statusStyle = getStatusStyle(status);

  return (
    <Text color={statusStyle.color}>
      {statusStyle.icon} {message || statusStyle.label}
    </Text>
  );
};

/**
 * Props for the TokenBar component (progress bar style)
 */
export interface TokenBarProps {
  /** Current token count */
  current: number;
  /** Maximum token limit */
  max: number;
  /** Width of the bar */
  width?: number;
}

/**
 * Token usage progress bar
 */
export const TokenBar: React.FC<TokenBarProps> = ({ current, max, width = 20 }) => {
  const percentage = Math.min((current / max) * 100, 100);
  const filled = Math.floor((percentage / 100) * width);
  const empty = width - filled;

  // Determine color based on usage
  let color: string = colors.success;
  if (percentage > 80) color = colors.error;
  else if (percentage > 60) color = colors.warning;

  return (
    <Box>
      <Text>[</Text>
      <Text color={color}>{'█'.repeat(filled)}</Text>
      <Text dimColor>{'░'.repeat(empty)}</Text>
      <Text>]</Text>
      <Text dimColor> {percentage.toFixed(0)}%</Text>
    </Box>
  );
};

/**
 * Props for the ToolStatus component
 */
export interface ToolStatusProps {
  /** Tool name */
  toolName: string;
  /** Tool execution state */
  state: 'pending' | 'running' | 'success' | 'error';
  /** Optional duration */
  duration?: number;
  /** Optional error message */
  error?: string;
}

/**
 * Tool execution status indicator
 */
export const ToolStatus: React.FC<ToolStatusProps> = ({ toolName, state, duration, error }) => {
  const getStateDisplay = () => {
    switch (state) {
      case 'pending':
        return { icon: '○', color: colors.warning, label: 'Pending' };
      case 'running':
        return { icon: '◐', color: colors.info, label: 'Running' };
      case 'success':
        return { icon: '✓', color: colors.success, label: 'Success' };
      case 'error':
        return { icon: '✗', color: colors.error, label: 'Error' };
    }
  };

  const stateDisplay = getStateDisplay();

  return (
    <Box>
      <Text color={stateDisplay.color}>
        {stateDisplay.icon} {toolName}: {stateDisplay.label}
      </Text>
      {duration !== undefined && (
        <Text dimColor>
          {' '}({duration}ms)
        </Text>
      )}
      {error && (
        <Text color={colors.error}>
          {' '}- {error}
        </Text>
      )}
    </Box>
  );
};

export default StatusPanel;
