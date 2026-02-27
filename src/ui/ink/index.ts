/**
 * @fileoverview Ink TUI layer exports
 * @module ui/ink
 */

// Theme exports
export { colors, themeStyles } from './theme/colors.js';
export type { Colors, ThemeStyles } from './theme/colors.js';

// Component exports
export { default as Markdown } from './components/Markdown.js';
export type { MarkdownProps } from './components/Markdown.js';

export { default as MessageBox, StreamMessage } from './components/MessageBox.js';
export type { MessageBoxProps, StreamMessageProps } from './components/MessageBox.js';

export { default as ChatPanel, WelcomeMessage, EmptyState } from './components/ChatPanel.js';
export type { ChatPanelProps, WelcomeMessageProps, EmptyStateProps } from './components/ChatPanel.js';

export { default as StatusPanel, StatusIndicator, TokenBar, ToolStatus } from './components/StatusPanel.js';
export type { StatusPanelProps, StatusIndicatorProps, TokenBarProps, ToolStatusProps } from './components/StatusPanel.js';

export { default as InputBox, MultilineInput } from './components/InputBox.js';
export type { InputBoxProps, MultilineInputProps } from './components/InputBox.js';

// App export
export { App, startTUI } from './App.js';
export type { AppProps } from './App.js';
