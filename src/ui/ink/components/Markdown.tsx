/**
 * @fileoverview Markdown rendering component for Ink TUI
 * @module ui/ink/components/Markdown
 */

import React from 'react';
import { Text, Box } from 'ink';
import { marked } from 'marked';
import type { colors, themeStyles } from '../theme/colors.js';

// Import theme styles
const theme: typeof themeStyles = {
  status: { idle: { color: '', label: '' }, processing: { color: '', label: '' }, error: { color: '', label: '' }, thinking: { color: '', label: '' } },
  toolStatus: { pending: { color: '', label: '' }, running: { color: '', label: '' }, success: { color: '', label: '' }, error: { color: '', label: '' } },
  messageBox: { user: { border: '', background: '', icon: '' }, assistant: { border: '', background: '', icon: '' }, system: { border: '', background: '', icon: '' }, tool: { border: '', background: '', icon: '' } },
  markdown: {
    heading: '#8b5cf6',
    code: '#10b981',
    link: '#3b82f6',
    quote: '#6b7280',
    list: '#f9fafb',
    bold: '#f59e0b',
    italic: '#6366f1',
  },
};

/**
 * Props for the Markdown component
 */
export interface MarkdownProps {
  /** Markdown content to render */
  content: string;
  /** Maximum width for line wrapping */
  maxWidth?: number;
  /** Whether to show syntax highlighting */
  highlight?: boolean;
}

/**
 * Parse markdown and render as Ink components
 */
export const Markdown: React.FC<MarkdownProps> = ({ content, maxWidth = 80, highlight = true }) => {
  // Parse markdown into tokens
  const tokens = marked.lexer(content);

  return (
    <Box flexDirection="column" width={maxWidth}>
      {tokens.map((token, index) => (
        <MarkdownToken key={index} token={token} maxWidth={maxWidth} highlight={highlight} />
      ))}
    </Box>
  );
};

/**
 * Props for individual token rendering
 */
interface TokenProps {
  token: marked.Token;
  maxWidth: number;
  highlight: boolean;
}

/**
 * Render individual markdown token
 */
const MarkdownToken: React.FC<TokenProps> = ({ token, maxWidth, highlight }) => {
  switch (token.type) {
    case 'heading': {
      const headingToken = token as marked.Tokens.Heading;
      const depth = headingToken.depth;
      const prefix = '#'.repeat(depth);
      const color = highlight ? theme.markdown.heading : undefined;
      return (
        <Box marginBottom={depth === 1 ? 1 : 0}>
          <Text bold color={color}>
            {prefix} {headingToken.text}
          </Text>
        </Box>
      );
    }

    case 'paragraph': {
      const paragraphToken = token as marked.Tokens.Paragraph;
      return (
        <Box marginBottom={1}>
          <Text>{paragraphToken.text}</Text>
        </Box>
      );
    }

    case 'code': {
      const codeToken = token as marked.Tokens.Code;
      const lines = codeToken.text.split('\n');
      return (
        <Box
          flexDirection="column"
          borderStyle="round"
          borderColor={highlight ? theme.markdown.code : undefined}
          paddingX={1}
          marginBottom={1}
          width={maxWidth}
        >
          {lines.map((line, i) => (
            <Text key={i} dimColor={!highlight}>
              {line || ' '}
            </Text>
          ))}
        </Box>
      );
    }

    case 'codespan': {
      const codespanToken = token as marked.Tokens.Codespan;
      return (
        <Text backgroundColor={highlight ? theme.markdown.code : undefined} color="#000">
          {codespanToken.text}
        </Text>
      );
    }

    case 'list': {
      const listToken = token as marked.Tokens.List;
      return (
        <Box flexDirection="column" marginBottom={1}>
          {listToken.items.map((item, i) => (
            <ListItem key={i} item={item} ordered={listToken.ordered} index={i} highlight={highlight} />
          ))}
        </Box>
      );
    }

    case 'blockquote': {
      const quoteToken = token as marked.Tokens.Blockquote;
      const lines = quoteToken.text.split('\n');
      return (
        <Box
          flexDirection="column"
          borderStyle="single"
          borderLeft
          borderColor={highlight ? theme.markdown.quote : undefined}
          paddingLeft={1}
          marginBottom={1}
        >
          {lines.map((line, i) => (
            <Text key={i} dimColor>
              {line}
            </Text>
          ))}
        </Box>
      );
    }

    case 'link': {
      const linkToken = token as marked.Tokens.Link;
      return (
        <Text color={highlight ? theme.markdown.link : undefined} underline>
          {linkToken.text}
        </Text>
      );
    }

    case 'strong': {
      const strongToken = token as marked.Tokens.Strong;
      return (
        <Text bold color={highlight ? theme.markdown.bold : undefined}>
          {strongToken.text}
        </Text>
      );
    }

    case 'em': {
      const emToken = token as marked.Tokens.Em;
      return (
        <Text italic color={highlight ? theme.markdown.italic : undefined}>
          {emToken.text}
        </Text>
      );
    }

    case 'hr': {
      return <Text dimColor>{'─'.repeat(Math.min(maxWidth, 40))}</Text>;
    }

    case 'space': {
      return <Text> </Text>;
    }

    default:
      return null;
  }
};

/**
 * Props for list item rendering
 */
interface ListItemProps {
  item: marked.Tokens.ListItem;
  ordered: boolean;
  index: number;
  highlight: boolean;
}

/**
 * Render list item
 */
const ListItem: React.FC<ListItemProps> = ({ item, ordered, index, highlight }) => {
  const prefix = ordered ? `${index + 1}.` : '•';
  const color = highlight ? theme.markdown.list : undefined;

  // Handle nested lists
  if (item.tokens.length > 0) {
    const hasNestedList = item.tokens.some(t => t.type === 'list');

    if (hasNestedList) {
      return (
        <Box flexDirection="column">
          <Text color={color}>
            {prefix} {item.text}
          </Text>
          <Box paddingLeft={2}>
            {item.tokens.map((token, i) => (
              token.type === 'list' ? (
                <MarkdownToken key={i} token={token} maxWidth={80} highlight={highlight} />
              ) : null
            ))}
          </Box>
        </Box>
      );
    }
  }

  return (
    <Box>
      <Text color={color}>
        {prefix} {item.text}
      </Text>
    </Box>
  );
};

export default Markdown;
