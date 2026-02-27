/**
 * @fileoverview Token counting utility for estimating token usage
 * @module domain/memory/token-counter
 */

import type { ChatMessage } from '../agent/types.js';

/**
 * Token counting statistics for message lists
 */
export interface TokenCountResult {
  /** Total estimated tokens */
  total: number;
  /** Breakdown by message role */
  byRole: Record<string, number>;
  /** Count by individual message */
  byMessage: number[];
}

/**
 * TokenCounter provides token estimation capabilities
 * Uses simple heuristics: Chinese chars * 1.5 + English words * 1
 */
export class TokenCounter {
  private readonly CHINESE_TOKEN_RATIO = 1.5;
  private readonly ENGLISH_WORD_TOKEN_RATIO = 1;

  /**
   * Regular expression to match Chinese characters
   */
  private readonly CHINESE_REGEX = /[\u4e00-\u9fff]/g;

  /**
   * Regular expression to match English words
   */
  private readonly ENGLISH_WORD_REGEX = /[a-zA-Z]+(-[a-zA-Z]+)*/g;

  /**
   * Count tokens in an array of chat messages
   * @param messages - Array of chat messages
   * @returns Token count result with breakdowns
   */
  countMessages(messages: ChatMessage[]): TokenCountResult {
    const byRole: Record<string, number> = {};
    const byMessage: number[] = [];
    let total = 0;

    for (const message of messages) {
      const count = this.countMessage(message);
      byMessage.push(count);

      const role = message.role;
      byRole[role] = (byRole[role] || 0) + count;
      total += count;
    }

    return { total, byRole, byMessage };
  }

  /**
   * Count tokens in a single chat message
   * @param message - Chat message to count
   * @returns Estimated token count
   */
  private countMessage(message: ChatMessage): number {
    let count = this.countText(message.content);

    // Account for metadata overhead
    if (message.metadata) {
      count += this.countString(JSON.stringify(message.metadata));
    }

    // Account for tool calls if present
    if (message.toolCalls && message.toolCalls.length > 0) {
      for (const toolCall of message.toolCalls) {
        count += this.countString(toolCall.name);
        count += this.countString(toolCall.arguments);
        // Overhead for tool call structure
        count += 10;
      }
    }

    // Base overhead for message structure
    count += 5;

    return count;
  }

  /**
   * Count tokens in a text string
   * Uses heuristic: Chinese characters * 1.5 + English words * 1
   * @param text - Text to count
   * @returns Estimated token count
   */
  countText(text: string): number {
    if (!text || text.length === 0) {
      return 0;
    }

    return this.countString(text);
  }

  /**
   * Count tokens in a string using the heuristic formula
   * @param str - String to count
   * @returns Estimated token count
   */
  countString(str: string): number {
    if (!str || str.length === 0) {
      return 0;
    }

    // Count Chinese characters
    const chineseMatches = str.match(this.CHINESE_REGEX);
    const chineseCount = chineseMatches ? chineseMatches.length : 0;

    // Remove Chinese characters and count English words
    const nonChineseText = str.replace(this.CHINESE_REGEX, ' ');
    const englishMatches = nonChineseText.match(this.ENGLISH_WORD_REGEX);
    const englishWordCount = englishMatches ? englishMatches.length : 0;

    // Apply heuristic formula
    return Math.ceil(chineseCount * this.CHINESE_TOKEN_RATIO + englishWordCount * this.ENGLISH_WORD_TOKEN_RATIO);
  }

  /**
   * Estimate tokens for an object (converts to JSON string)
   * @param obj - Object to estimate tokens for
   * @returns Estimated token count
   */
  countObject(obj: unknown): number {
    try {
      const jsonStr = JSON.stringify(obj);
      return this.countString(jsonStr);
    } catch {
      return 0;
    }
  }

  /**
   * Get the Chinese token ratio
   * @returns Current ratio for Chinese character token estimation
   */
  getChineseTokenRatio(): number {
    return this.CHINESE_TOKEN_RATIO;
  }

  /**
   * Get the English word token ratio
   * @returns Current ratio for English word token estimation
   */
  getEnglishWordTokenRatio(): number {
    return this.ENGLISH_WORD_TOKEN_RATIO;
  }
}
