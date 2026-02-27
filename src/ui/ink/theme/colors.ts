/**
 * @fileoverview Color theme constants for Ink TUI
 * @module ui/ink/theme/colors
 */

/**
 * ANSI color codes for terminal theming
 */
export const colors = {
  // Primary colors
  primary: '#6366f1', // Indigo-500
  primaryDim: '#4f46e5', // Indigo-600

  // Secondary colors
  secondary: '#8b5cf6', // Violet-500
  secondaryDim: '#7c3aed', // Violet-600

  // Success colors
  success: '#10b981', // Emerald-500
  successDim: '#059669', // Emerald-600

  // Warning colors
  warning: '#f59e0b', // Amber-500
  warningDim: '#d97706', // Amber-600

  // Error colors
  error: '#ef4444', // Red-500
  errorDim: '#dc2626', // Red-600

  // Info colors
  info: '#3b82f6', // Blue-500
  infoDim: '#2563eb', // Blue-600

  // Neutral colors
  gray: {
    50: '#f9fafb',
    100: '#f3f4f6',
    200: '#e5e7eb',
    300: '#d1d5db',
    400: '#9ca3af',
    500: '#6b7280',
    600: '#4b5563',
    700: '#374151',
    800: '#1f2937',
    900: '#111827',
  },

  // Message role colors
  user: '#3b82f6', // Blue-500
  assistant: '#10b981', // Emerald-500
  system: '#8b5cf6', // Violet-500
  tool: '#f59e0b', // Amber-500

  // Border colors
  border: '#374151', // Gray-700
  borderDim: '#4b5563', // Gray-600

  // Background colors
  background: '#111827', // Gray-900
  backgroundDim: '#1f2937', // Gray-800
  surface: '#1f2937', // Gray-800
  surfaceDim: '#374151', // Gray-700

  // Text colors
  text: '#f9fafb', // Gray-50
  textDim: '#d1d5db', // Gray-300
  textMuted: '#9ca3af', // Gray-400
} as const;

/**
 * Theme styles for different UI elements
 */
export const themeStyles = {
  // Message box styles
  messageBox: {
    user: {
      border: colors.user,
      background: colors.gray[800],
      icon: 'You',
    },
    assistant: {
      border: colors.assistant,
      background: colors.gray[800],
      icon: 'AI',
    },
    system: {
      border: colors.system,
      background: colors.gray[800],
      icon: 'SYS',
    },
    tool: {
      border: colors.tool,
      background: colors.gray[800],
      icon: 'TOOL',
    },
  },

  // Status indicator styles
  status: {
    idle: {
      color: colors.success,
      label: 'Ready',
    },
    processing: {
      color: colors.info,
      label: 'Processing',
    },
    error: {
      color: colors.error,
      label: 'Error',
    },
    thinking: {
      color: colors.warning,
      label: 'Thinking',
    },
  },

  // Tool status styles
  toolStatus: {
    pending: {
      color: colors.warning,
      label: 'Pending',
    },
    running: {
      color: colors.info,
      label: 'Running',
    },
    success: {
      color: colors.success,
      label: 'Success',
    },
    error: {
      color: colors.error,
      label: 'Error',
    },
  },

  // Markdown syntax highlighting
  markdown: {
    heading: colors.secondary,
    code: colors.success,
    link: colors.info,
    quote: colors.gray[500],
    list: colors.text,
    bold: colors.warning,
    italic: colors.primary,
  },
} as const;

export type Colors = typeof colors;
export type ThemeStyles = typeof themeStyles;
