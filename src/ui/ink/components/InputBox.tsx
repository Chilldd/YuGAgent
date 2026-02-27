/**
 * @fileoverview Input box component for user input
 * @module ui/ink/components/InputBox
 */

import React, { useState, useEffect, useRef } from 'react';
import { Box, Text, useInput } from 'ink';
import { colors } from '../theme/colors.js';

/**
 * Props for the InputBox component
 */
export interface InputBoxProps {
  /** Placeholder text when input is empty */
  placeholder?: string;
  /** Callback when user submits input */
  onSubmit: (value: string) => void;
  /** Callback when user cancels input */
  onCancel?: () => void;
  /** Whether input is disabled */
  disabled?: boolean;
  /** Maximum input length */
  maxLength?: number;
  /** Maximum width for display */
  maxWidth?: number;
  /** Prompt prefix */
  prompt?: string;
  /** Whether to show character count */
  showCharCount?: boolean;
}

/**
 * Input box component with readline-like behavior
 */
export const InputBox: React.FC<InputBoxProps> = ({
  placeholder = 'Type your message...',
  onSubmit,
  onCancel,
  disabled = false,
  maxLength = 1000,
  maxWidth = 80,
  prompt = '>',
  showCharCount = false,
}) => {
  const [value, setValue] = useState('');
  const [cursorPosition, setCursorPosition] = useState(0);
  const isComposingRef = useRef(false);

  // Handle user input
  useInput((input, key) => {
    if (disabled) {
      return;
    }

    // Handle Ctrl+C to cancel
    if (key.ctrl && input === 'c') {
      setValue('');
      setCursorPosition(0);
      if (onCancel) {
        onCancel();
      }
      return;
    }

    // Ignore input during composition (e.g., IME for CJK characters)
    if (isComposingRef.current) {
      return;
    }

    // Handle Enter to submit
    if (key.return) {
      if (value.trim().length > 0) {
        onSubmit(value.trim());
        setValue('');
        setCursorPosition(0);
      }
      return;
    }

    // Handle backspace
    if (key.backspace) {
      if (value.length > 0 && cursorPosition > 0) {
        const newValue =
          cursorPosition === value.length
            ? value.slice(0, -1)
            : value.slice(0, cursorPosition - 1) + value.slice(cursorPosition);
        setValue(newValue);
        setCursorPosition(cursorPosition - 1);
      }
      return;
    }

    // Handle delete
    if (key.delete) {
      if (cursorPosition < value.length) {
        const newValue = value.slice(0, cursorPosition) + value.slice(cursorPosition + 1);
        setValue(newValue);
      }
      return;
    }

    // Handle arrow keys for cursor movement
    if (key.leftArrow) {
      setCursorPosition(Math.max(0, cursorPosition - 1));
      return;
    }

    if (key.rightArrow) {
      setCursorPosition(Math.min(value.length, cursorPosition + 1));
      return;
    }

    // Handle home key
    if (key.home) {
      setCursorPosition(0);
      return;
    }

    // Handle end key
    if (key.end) {
      setCursorPosition(value.length);
      return;
    }

    // Handle Ctrl+U to clear input
    if (key.ctrl && input === 'u') {
      setValue('');
      setCursorPosition(0);
      return;
    }

    // Handle regular character input
    if (input) {
      const newValue =
        cursorPosition === value.length
          ? value + input
          : value.slice(0, cursorPosition) + input + value.slice(cursorPosition);

      if (newValue.length <= maxLength) {
        setValue(newValue);
        setCursorPosition(cursorPosition + 1);
      }
    }
  });

  // Calculate display width accounting for prompt and char count
  const promptWidth = prompt.length + 1;
  const charCountWidth = showCharCount ? ` [${value.length}/${maxLength}]`.length : 0;
  const availableWidth = maxWidth - promptWidth - charCountWidth;

  // Truncate value for display if needed
  const displayValue = value.length > availableWidth
    ? '...' + value.slice(-availableWidth + 3)
    : value;

  return (
    <Box width={maxWidth}>
      <Box flexGrow={1}>
        {/* Prompt */}
        <Text bold color={colors.primary}>
          {prompt}{' '}
        </Text>

        {/* Input value or placeholder */}
        {value.length === 0 ? (
          <Text dimColor>{placeholder}</Text>
        ) : (
          <Text>
            {displayValue}
          </Text>
        )}

        {/* Cursor indicator */}
        {!disabled && (
          <Text backgroundColor={colors.primary} reverse>
            {' '}
          </Text>
        )}
      </Box>

      {/* Character count */}
      {showCharCount && (
        <Text dimColor>
          {' '}[{value.length}/{maxLength}]
        </Text>
      )}
    </Box>
  );
};

/**
 * Props for the MultilineInput component
 */
export interface MultilineInputProps {
  /** Placeholder text */
  placeholder?: string;
  /** Callback when user submits input */
  onSubmit: (value: string) => void;
  /** Callback when user cancels */
  onCancel?: () => void;
  /** Whether input is disabled */
  disabled?: boolean;
  /** Maximum number of lines */
  maxLines?: number;
  /** Maximum width */
  maxWidth?: number;
  /** Prompt prefix */
  prompt?: string;
}

/**
 * Multiline input box component
 */
export const MultilineInput: React.FC<MultilineInputProps> = ({
  placeholder = 'Type your message (Enter to submit, Shift+Enter for newline)...',
  onSubmit,
  onCancel,
  disabled = false,
  maxLines = 5,
  maxWidth = 80,
  prompt = '>',
}) => {
  const [lines, setLines] = useState<string[]>(['']);
  const [currentLine, setCurrentLine] = useState(0);

  useInput((input, key) => {
    if (disabled) {
      return;
    }

    // Handle Ctrl+C to cancel
    if (key.ctrl && input === 'c') {
      setLines(['']);
      setCurrentLine(0);
      if (onCancel) {
        onCancel();
      }
      return;
    }

    // Handle Enter
    if (key.return) {
      if (key.shift) {
        // Shift+Enter for newline
        if (lines.length < maxLines) {
          const newLines = [...lines];
          newLines.splice(currentLine + 1, 0, '');
          setLines(newLines);
          setCurrentLine(currentLine + 1);
        }
      } else {
        // Plain Enter to submit
        const value = lines.join('\n').trim();
        if (value.length > 0) {
          onSubmit(value);
          setLines(['']);
          setCurrentLine(0);
        }
      }
      return;
    }

    // Handle backspace
    if (key.backspace) {
      const currentText = lines[currentLine];
      if (currentText.length > 0) {
        const newLines = [...lines];
        newLines[currentLine] = currentText.slice(0, -1);
        setLines(newLines);
      } else if (currentLine > 0) {
        // Join with previous line
        const newLines = [...lines];
        newLines.splice(currentLine, 1);
        setLines(newLines);
        setCurrentLine(currentLine - 1);
      }
      return;
    }

    // Handle regular character input
    if (input) {
      const newLines = [...lines];
      newLines[currentLine] = lines[currentLine] + input;
      setLines(newLines);
    }
  });

  return (
    <Box flexDirection="column" width={maxWidth}>
      {lines.map((line, index) => (
        <Box key={index} width={maxWidth}>
          <Text bold color={index === currentLine ? colors.primary : colors.gray[500]}>
            {index === currentLine ? prompt : ' '}
          </Text>
          {index === currentLine && line.length === 0 ? (
            <Text dimColor>{placeholder}</Text>
          ) : (
            <Text>{line}</Text>
          )}
        </Box>
      ))}
    </Box>
  );
};

export default InputBox;
