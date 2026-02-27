/**
 * @fileoverview Input box component for user input
 * @module ui/ink/components/InputBox
 */

import React, { useState } from 'react';
import { Box, Text } from 'ink';
import TextInput from 'ink-text-input';
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
 * Input box component using Ink's built-in TextInput
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

  const handleSubmit = (inputValue: string) => {
    const trimmedValue = inputValue.trim();
    if (trimmedValue.length > 0) {
      onSubmit(trimmedValue);
      setValue('');
    }
  };

  return (
    <Box width={maxWidth}>
      <Box flexGrow={1}>
        {/* Prompt */}
        <Text bold color={colors.primary}>
          {prompt}{' '}
        </Text>

        {/* TextInput - Ink's built-in component */}
        {!disabled && (
          <TextInput
            value={value}
            onChange={setValue}
            onSubmit={handleSubmit}
            placeholder={placeholder}
          />
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
