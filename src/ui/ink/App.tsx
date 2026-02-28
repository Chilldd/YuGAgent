/**
 * @fileoverview Main App component for Ink TUI
 * @module ui/ink/App
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Box, Text, render, useStdout } from 'ink';

import { ChatPanel, WelcomeMessage, EmptyState } from './components/ChatPanel.js';
import { StatusPanel } from './components/StatusPanel.js';
import { InputBox } from './components/InputBox.js';
import { colors } from './theme/colors.js';

import type { ChatMessage } from '../../domain/agent/types.js';
import type { AIService } from '../../application/services/ai-service.js';
import type { ServiceStatus } from '../../application/dto/chat.dto.js';

/**
 * Props for the App component
 */
export interface AppProps {
  /** AI service instance */
  aiService: AIService;
  /** Application name */
  appName?: string;
  /** Application version */
  version?: string;
  /** Maximum terminal width */
  maxWidth?: number;
}

/**
 * Main App component state
 */
interface AppState {
  messages: ChatMessage[];
  streamingContent: string;
  isStreaming: boolean;
  status: ServiceStatus;
  tokenUsage: { promptTokens: number; completionTokens: number; totalTokens: number };
  model: string;
  sessionId: string;
  processingMessage: string;
  showWelcome: boolean;
  error: string | null;
}

/**
 * Main TUI Application component
 */
const App: React.FC<AppProps> = ({
  aiService,
  appName = 'YuGAgent',
  version = '2.0.0',
  maxWidth: propMaxWidth = 100,
}) => {
  const [state, setState] = useState<AppState>({
    messages: [],
    streamingContent: '',
    isStreaming: false,
    status: 'initializing' as ServiceStatus,
    tokenUsage: { promptTokens: 0, completionTokens: 0, totalTokens: 0 },
    model: '',
    sessionId: '',
    processingMessage: '',
    showWelcome: true,
    error: null,
  });

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const isMountedRef = useRef(true);

  // Loading 动画帧
  const loadingFrames = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];
  const [loadingFrameIndex, setLoadingFrameIndex] = useState(0);

  // Loading 动画定时器
  useEffect(() => {
    // 只在处理状态时启动动画
    if (state.status !== 'processing') {
      setLoadingFrameIndex(0);
      return;
    }

    const interval = setInterval(() => {
      setLoadingFrameIndex(prev => (prev + 1) % loadingFrames.length);
    }, 100);

    return () => clearInterval(interval);
  }, [state.status, loadingFrames.length]);

  // Initialize app and setup event listeners
  useEffect(() => {
    isMountedRef.current = true;

    // Get initial status
    const statusInfo = aiService.getStatus();
    const sessionId = aiService.getSessionId() || '';

    setState(prev => ({
      ...prev,
      status: statusInfo.status,
      model: statusInfo.model || 'unknown',
      sessionId,
      tokenUsage: {
        promptTokens: 0,
        completionTokens: 0,
        totalTokens: statusInfo.totalTokens || 0,
      },
    }));

    // Setup event listeners
    const setupListeners = () => {
      // Service initialization
      aiService.on('initialized', (data: any) => {
        if (isMountedRef.current) {
          setState(prev => ({
            ...prev,
            status: 'idle' as ServiceStatus,
            sessionId: data.sessionId,
            showWelcome: true,
          }));
        }
      });

      // Before message - set processing state
      aiService.on('beforeMessage', (data: any) => {
        if (isMountedRef.current) {
          setState(prev => ({
            ...prev,
            status: 'processing' as ServiceStatus,
            processingMessage: 'Sending your message...',
            showWelcome: false,
          }));
        }
      });

      // Hook events for detailed status
      aiService.on('hook', (data: any) => {
        if (!isMountedRef.current) return;

        const { event } = data;
        switch (event) {
          case 'start':
            setState(prev => ({
              ...prev,
              status: 'processing' as ServiceStatus,
              processingMessage: 'Starting conversation...',
            }));
            break;
          case 'thinking':
            setState(prev => ({
              ...prev,
              status: 'processing' as ServiceStatus,
              processingMessage: 'AI is thinking...',
            }));
            break;
          case 'contentChunk': {
            // Hook payload 结构: { event, data: HookContext }
            // 内容位于 HookContext.data.content
            const chunkContent = data.data?.data?.content;
            if (typeof chunkContent === 'string' && chunkContent.length > 0) {
              setState(prev => ({
                ...prev,
                streamingContent: (prev.streamingContent || '') + chunkContent,
              }));
            }
            break;
          }
          case 'messagesUpdate':
            // 优先使用 hook 事件内的最新消息，避免等待 sendMessage 完成后才更新
            setState(prev => ({
              ...prev,
              messages: Array.isArray(data.data?.messages) ? [...data.data.messages] : prev.messages,
              streamingContent: '',
            }));
            break;
          case 'beforeTool':
            const toolName = data.data?.toolCall?.name || 'unknown';
            setState(prev => ({
              ...prev,
              processingMessage: `Running tool: ${toolName}...`,
            }));
            break;
          case 'afterTool':
            setState(prev => ({
              ...prev,
              processingMessage: 'Processing tool result...',
            }));
            break;
          case 'complete':
            setState(prev => ({
              ...prev,
              status: 'idle' as ServiceStatus,
              processingMessage: '',
            }));
            break;
          case 'error':
            setState(prev => ({
              ...prev,
              status: 'error' as ServiceStatus,
              processingMessage: 'An error occurred',
              error: data.data?.error?.message || 'Unknown error',
            }));
            break;
        }
      });

      // After message - update messages and token usage
      aiService.on('afterMessage', (data: any) => {
        if (!isMountedRef.current) return;

        const context = aiService.getContext();
        if (context) {
          const messages = context.getMessages();
          setState(prev => ({
            ...prev,
            messages: [...messages],
            status: 'idle' as ServiceStatus,
            streamingContent: '',
            isStreaming: false,
            tokenUsage: data.response?.tokenUsage || prev.tokenUsage,
            processingMessage: '',
          }));
        }
      });

      // Message error
      aiService.on('messageError', (data: any) => {
        if (isMountedRef.current) {
          setState(prev => ({
            ...prev,
            status: 'error' as ServiceStatus,
            processingMessage: '',
            error: data.error?.message || 'Failed to send message',
          }));
        }
      });

      // Shutdown
      aiService.on('shutdown', () => {
        if (isMountedRef.current) {
          setState(prev => ({
            ...prev,
            status: 'stopped' as ServiceStatus,
          }));
        }
      });
    };

    setupListeners();

    // Cleanup on unmount - 移除所有监听器
    return () => {
      isMountedRef.current = false;
      // 使用 removeAllListeners 清理所有事件监听器
      aiService.removeAllListeners();
    };
  }, [aiService]);

  // Track terminal dimensions from Ink to avoid manual resize side effects
  const { stdout } = useStdout();
  const terminalWidth = stdout.columns || 80;
  const contentMaxWidth = Math.min(propMaxWidth, Math.max(20, terminalWidth - 4));

  // Handle user input submission
  const handleSubmit = useCallback(async (input: string) => {
    if (!aiService.isReady() || state.isStreaming) {
      return;
    }

    // step1. 立即添加用户消息到显示状态，实现即时反馈
    const { MessageRole } = await import('../../domain/agent/types.js');
    const userMessage: ChatMessage = {
      role: MessageRole.USER,
      content: input,
      metadata: {
        id: Date.now().toString(),
        timestamp: new Date().toISOString(),
      },
    };

    setState(prev => ({
      ...prev,
      messages: [...prev.messages, userMessage],
      isStreaming: true,
      streamingContent: '',
      status: 'processing' as ServiceStatus,
      showWelcome: false,
    }));

    try {
      const response = await aiService.sendMessage({ message: input });

      // step2. 从 context 更新完整消息列表（包含 AI 响应）
      const context = aiService.getContext();
      if (context) {
        const messages = context.getMessages();
        setState(prev => ({
          ...prev,
          messages: [...messages],
          tokenUsage: response.tokenUsage,
        }));
      }
    } catch (error) {
      setState(prev => ({
        ...prev,
        error: error instanceof Error ? error.message : 'Unknown error',
        status: 'error' as ServiceStatus,
      }));
    } finally {
      setState(prev => ({
        ...prev,
        isStreaming: false,
        streamingContent: '',
        status: 'idle' as ServiceStatus,
      }));
    }
  }, [aiService, state.isStreaming]);

  // Handle cancel (Ctrl+C)
  const handleCancel = useCallback(() => {
    if (state.isStreaming) {
      // Just stop streaming, don't exit
      setState(prev => ({
        ...prev,
        isStreaming: false,
        streamingContent: '',
      }));
    } else {
      // Exit the app
      aiService.shutdown();
      process.exit(0);
    }
  }, [aiService, state.isStreaming]);

  // Get terminal height for chat panel
  return (
    <Box flexDirection="column" paddingX={1}>
      {/* Main content area */}
      <Box flexDirection="column" marginBottom={1} flexGrow={1}>
        {/* Welcome message or chat panel */}
        {state.showWelcome ? (
          <WelcomeMessage
            appName={appName}
            version={version}
            model={state.model}
            sessionId={state.sessionId}
            maxWidth={contentMaxWidth - 2}
          />
        ) : state.messages.length === 0 ? (
          <EmptyState maxWidth={contentMaxWidth - 2} />
        ) : (
          <ChatPanel
            messages={state.messages}
            streamingContent={state.streamingContent}
            isStreaming={state.isStreaming}
            maxWidth={contentMaxWidth - 2}
          />
        )}

        {/* Error display */}
        {state.error && (
          <Box marginTop={1}>
            <Text color={colors.error}>
              Error: {state.error}
            </Text>
          </Box>
        )}
      </Box>

      {/* Input box */}
      <Box marginTop={1}>
        <InputBox
          prompt=">"
          placeholder="Type your message..."
          onSubmit={handleSubmit}
          onCancel={handleCancel}
          disabled={state.isStreaming || state.status === 'stopped'}
          maxLength={2000}
          maxWidth={contentMaxWidth - 2}
          showCharCount={false}
        />
      </Box>

      {/* 状态栏 - 合并状态指示器、模型、处理消息和Token */}
      <Box marginTop={1} paddingX={1} borderStyle="single" borderColor={colors.gray[700]}>
        <Box justifyContent="space-between" width={contentMaxWidth - 6}>
          <Box>
            {state.status === 'processing' ? (
              <Text color={colors.info} bold>
                {loadingFrames[loadingFrameIndex]} <Text color={colors.success}>{state.model}</Text>
              </Text>
            ) : (
              <Text color={colors.success} bold>
                ● {state.model}
              </Text>
            )}
            {state.processingMessage && (
              <Text dimColor> | {state.processingMessage}</Text>
            )}
          </Box>
          <Box>
            {state.status === 'processing' && (
              <Text color={colors.info} bold>
                {loadingFrames[loadingFrameIndex]}
              </Text>
            )}
            {state.tokenUsage.totalTokens > 0 && (
              <Text dimColor>
                Tokens: <Text color={colors.warning}>{state.tokenUsage.totalTokens}</Text>
              </Text>
            )}
          </Box>
        </Box>
      </Box>

      {/* Help hint - 精简 */}
      <Box marginTop={1} justifyContent="flex-end">
        <Text dimColor>
          Enter:发送 | Ctrl+C:退出
        </Text>
      </Box>
    </Box>
  );
};

/**
 * Status indicator component (inline)
 */
interface StatusIndicatorProps {
  status: ServiceStatus;
}

const StatusIndicator: React.FC<StatusIndicatorProps> = ({ status }) => {
  const getStatusDisplay = () => {
    switch (status) {
      case 'idle':
        return { icon: '●', color: colors.success, label: 'Ready' };
      case 'processing':
        return { icon: '◐', color: colors.info, label: 'Processing' };
      case 'error':
        return { icon: '●', color: colors.error, label: 'Error' };
      case 'initializing':
        return { icon: '○', color: colors.warning, label: 'Init' };
      case 'stopped':
        return { icon: '○', color: colors.gray[500], label: 'Stopped' };
      default:
        return { icon: '○', color: colors.gray[500], label: 'Unknown' };
    }
  };

  const { icon, color, label } = getStatusDisplay();

  return (
    <Text color={color}>
      {icon} {label}
    </Text>
  );
};

/**
 * Start the TUI application
 *
 * @param aiService - The AI service instance
 * @param appName - Application name
 * @param version - Application version
 */
export function startTUI(
  aiService: AIService,
  appName = 'YuGAgent',
  version = '2.0.0'
): void {
  const { waitUntilExit } = render(
    <App
      aiService={aiService}
      appName={appName}
      version={version}
    />
  );

  // step1. 等待 UI 退出
  // step2. 确保 shutdown 被调用，即使发生错误
  waitUntilExit().then(
    () => {
      aiService.shutdown();
    },
    (error) => {
      // step3. 如果 waitUntilExit 失败，仍然执行 shutdown
      console.error('Error during UI shutdown:', error);
      aiService.shutdown();
    }
  );
}

export default App;
