/**
 * @fileoverview Truncation strategy interface and implementations for context management
 * @module domain/context/truncation-strategy
 */

import type { ChatMessage } from '../agent/types.js';

/**
 * Result of a truncation operation
 */
export interface TruncationResult {
  /** The truncated message list */
  messages: ChatMessage[];
  /** Number of messages removed */
  removedCount: number;
  /** Whether the system message was preserved */
  systemPreserved: boolean;
  /** Original message count before truncation */
  originalCount: number;
  /** Target size for truncation */
  targetSize: number;
}

/**
 * Interface for context truncation strategies
 */
export interface ITruncationStrategy {
  /**
   * Truncate messages to fit within a target size
   * @param messages - Current message list
   * @param targetSize - Target number of messages (excluding system)
   * @returns Truncation result
   */
  truncate(messages: ChatMessage[], targetSize: number): TruncationResult;

  /**
   * Get the name of this strategy
   */
  getName(): string;

  /**
   * Get a description of how this strategy works
   */
  getDescription(): string;
}

/**
 * Recent truncation strategy - keeps system message and most recent messages
 * Removes oldest user/assistant messages first
 */
export class RecentTruncationStrategy implements ITruncationStrategy {
  getName(): string {
    return 'recent';
  }

  getDescription(): string {
    return 'Keeps system message and most recent messages, removing oldest first';
  }

  truncate(messages: ChatMessage[], targetSize: number): TruncationResult {
    const originalCount = messages.length;
    const systemMessage = messages.find(m => m.role === 'system');

    // Separate system message from other messages
    const nonSystemMessages = messages.filter(m => m.role !== 'system');
    const currentNonSystemCount = nonSystemMessages.length;

    // If already under target, no truncation needed
    if (currentNonSystemCount <= targetSize) {
      return {
        messages: [...messages],
        removedCount: 0,
        systemPreserved: !!systemMessage,
        originalCount,
        targetSize,
      };
    }

    // Remove oldest messages until we reach target size
    const removeCount = currentNonSystemCount - targetSize;
    const truncatedMessages = nonSystemMessages.slice(removeCount);

    // Combine system message (if exists) with truncated messages
    const result = systemMessage
      ? [systemMessage, ...truncatedMessages]
      : truncatedMessages;

    return {
      messages: result,
      removedCount: removeCount,
      systemPreserved: !!systemMessage,
      originalCount,
      targetSize,
    };
  }
}

/**
 * Least-recent truncation strategy - prioritizes keeping recently accessed messages
 * Uses access count metadata if available
 */
export class LeastRecentTruncationStrategy implements ITruncationStrategy {
  getName(): string {
    return 'least-recent';
  }

  getDescription(): string {
    return 'Removes messages with lowest access count, preferring to keep recently used ones';
  }

  truncate(messages: ChatMessage[], targetSize: number): TruncationResult {
    const originalCount = messages.length;
    const systemMessage = messages.find(m => m.role === 'system');

    // Separate system message from other messages
    let nonSystemMessages = messages.filter(m => m.role !== 'system');
    const currentNonSystemCount = nonSystemMessages.length;

    // If already under target, no truncation needed
    if (currentNonSystemCount <= targetSize) {
      return {
        messages: [...messages],
        removedCount: 0,
        systemPreserved: !!systemMessage,
        originalCount,
        targetSize,
      };
    }

    // Sort by access count (ascending) - remove least accessed first
    // If no access metadata, fall back to original order
    nonSystemMessages = [...nonSystemMessages].sort((a, b) => {
      const aAccess = (a.metadata?.accessCount as number) ?? 0;
      const bAccess = (b.metadata?.accessCount as number) ?? 0;
      return aAccess - bAccess;
    });

    // Remove least accessed messages
    const removeCount = currentNonSystemCount - targetSize;
    const keptMessages = nonSystemMessages.slice(removeCount);

    // Sort kept messages back to original order based on position
    const originalOrder = messages.filter(m => m.role !== 'system');
    const truncatedMessages = keptMessages.sort((a, b) => {
      const aIndex = originalOrder.findIndex(m => m === a);
      const bIndex = originalOrder.findIndex(m => m === b);
      return aIndex - bIndex;
    });

    // Combine system message (if exists) with truncated messages
    const result = systemMessage
      ? [systemMessage, ...truncatedMessages]
      : truncatedMessages;

    return {
      messages: result,
      removedCount: removeCount,
      systemPreserved: !!systemMessage,
      originalCount,
      targetSize,
    };
  }
}

/**
 * Smart truncation strategy - considers importance scores and message types
 * Keeps important messages and recent tool results
 */
export class SmartTruncationStrategy implements ITruncationStrategy {
  getName(): string {
    return 'smart';
  }

  getDescription(): string {
    return 'Uses importance scores and heuristics to keep critical messages';
  }

  truncate(messages: ChatMessage[], targetSize: number): TruncationResult {
    const originalCount = messages.length;
    const systemMessage = messages.find(m => m.role === 'system');

    // Separate system message from other messages
    let nonSystemMessages = messages.filter(m => m.role !== 'system');
    const currentNonSystemCount = nonSystemMessages.length;

    // If already under target, no truncation needed
    if (currentNonSystemCount <= targetSize) {
      return {
        messages: [...messages],
        removedCount: 0,
        systemPreserved: !!systemMessage,
        originalCount,
        targetSize,
      };
    }

    // Score messages based on multiple factors
    const scoredMessages = nonSystemMessages.map((msg, index) => ({
      message: msg,
      score: this.calculateScore(msg, index, currentNonSystemCount),
      originalIndex: index,
    }));

    // Sort by score (descending) - keep highest scores
    scoredMessages.sort((a, b) => b.score - a.score);

    // Remove lowest scored messages
    const removeCount = currentNonSystemCount - targetSize;
    const keptMessages = scoredMessages.slice(removeCount);

    // Sort kept messages back to original order
    keptMessages.sort((a, b) => a.originalIndex - b.originalIndex);

    const truncatedMessages = keptMessages.map(s => s.message);

    // Combine system message (if exists) with truncated messages
    const result = systemMessage
      ? [systemMessage, ...truncatedMessages]
      : truncatedMessages;

    return {
      messages: result,
      removedCount: removeCount,
      systemPreserved: !!systemMessage,
      originalCount,
      targetSize,
    };
  }

  /**
   * Calculate importance score for a message
   * Higher score = more important = should be kept
   */
  private calculateScore(
    message: ChatMessage,
    index: number,
    totalCount: number
  ): number {
    let score = 0;

    // Recent messages get higher scores
    const recencyFactor = index / totalCount;
    score += recencyFactor * 50;

    // Explicit importance score from metadata
    const importanceScore = message.metadata?.importance as number | undefined;
    if (importanceScore !== undefined && typeof importanceScore === 'number' && !isNaN(importanceScore)) {
      score += importanceScore * 100;
    }

    // Tool results are important (keep for context)
    if (message.role === 'tool') {
      score += 30;
    }

    // Assistant messages with tool calls are important
    if (message.role === 'assistant' && message.toolCalls && message.toolCalls.length > 0) {
      score += 40;
    }

    // Very recent messages (last 25%) get extra boost
    if (index >= totalCount * 0.75) {
      score += 20;
    }

    // User messages are generally more important than assistant messages
    if (message.role === 'user') {
      score += 10;
    }

    return score;
  }
}

/**
 * Factory function to create truncation strategy by name
 * @param strategy - Strategy name ('oldest', 'least-recent', 'smart')
 * @returns Truncation strategy instance
 */
export function createTruncationStrategy(strategy: 'oldest' | 'least-recent' | 'smart'): ITruncationStrategy {
  switch (strategy) {
    case 'oldest':
      return new RecentTruncationStrategy();
    case 'least-recent':
      return new LeastRecentTruncationStrategy();
    case 'smart':
      return new SmartTruncationStrategy();
    default:
      return new RecentTruncationStrategy();
  }
}
