/**
 * @fileoverview Memory Manager implementation
 * @module domain/memory/manager
 */

import { v4 as uuidv4 } from 'uuid';

import type { ChatMessage } from '../agent/types.js';
import type {
  IMemoryManager,
  MemoryEntry,
  MemoryRetrievalOptions,
  MemoryStats,
} from './types.js';
import { MemoryType } from './types.js';
import { SessionStore } from './session-store.js';
import { TokenCounter } from './token-counter.js';

/**
 * Token usage statistics for tracking memory operations
 */
export interface TokenStats {
  /** Total tokens used across all operations */
  total: number;
  /** Tokens used for input (prompts) */
  input: number;
  /** Tokens used for output (completions) */
  output: number;
  /** Timestamp of last update */
  lastUpdated: Date;
}

/**
 * Memory Manager implementation with token tracking and in-memory storage
 */
export class MemoryManager implements IMemoryManager {
  private readonly memories: SessionStore<string, MemoryEntry>;
  private readonly tokenCounter: TokenCounter;
  private readonly tokenStats: TokenStats;

  constructor() {
    this.memories = new SessionStore<string, MemoryEntry>();
    this.tokenCounter = new TokenCounter();
    this.tokenStats = {
      total: 0,
      input: 0,
      output: 0,
      lastUpdated: new Date(),
    };
  }

  /**
   * Store a memory entry
   * @param entry - The memory entry to store (without id, createdAt, lastAccessed, accessCount)
   * @returns The stored memory entry with generated fields
   */
  store(entry: Omit<MemoryEntry, 'id' | 'createdAt' | 'lastAccessed' | 'accessCount'>): MemoryEntry {
    const now = new Date();
    const memoryEntry: MemoryEntry = {
      ...entry,
      id: uuidv4(),
      createdAt: now,
      lastAccessed: now,
      accessCount: 0,
    };

    this.memories.set(memoryEntry.id, memoryEntry);
    return memoryEntry;
  }

  /**
   * Retrieve a memory by ID
   * @param id - The memory ID
   * @returns The memory entry or undefined if not found
   */
  retrieve(id: string): MemoryEntry | undefined {
    const memory = this.memories.get(id);
    if (memory) {
      // Update access tracking
      memory.lastAccessed = new Date();
      memory.accessCount++;
    }
    return memory;
  }

  /**
   * Search for memories based on criteria
   * @param options - Retrieval options
   * @returns Array of matching memory entries
   */
  search(options: MemoryRetrievalOptions): MemoryEntry[] {
    let results = this.memories.values();

    // Filter by type
    if (options.type) {
      results = results.filter(m => m.type === options.type);
    }

    // Filter by tags
    if (options.tags && options.tags.length > 0) {
      results = results.filter(m =>
        options.tags!.some(tag => m.tags.includes(tag))
      );
    }

    // Filter by minimum importance
    if (options.minImportance !== undefined) {
      results = results.filter(m => m.importance >= options.minImportance!);
    }

    // Semantic filtering by query (basic text matching)
    // In a full implementation, this would use vector embeddings
    if (options.query) {
      const queryLower = options.query.toLowerCase();
      results = results.filter(m =>
        m.content.toLowerCase().includes(queryLower) ||
        m.tags.some(tag => tag.toLowerCase().includes(queryLower))
      );
    }

    // Sort by importance (descending) and last accessed (descending)
    results.sort((a, b) => {
      if (a.importance !== b.importance) {
        return b.importance - a.importance;
      }
      return b.lastAccessed.getTime() - a.lastAccessed.getTime();
    });

    // Apply limit
    if (options.limit && options.limit > 0) {
      results = results.slice(0, options.limit);
    }

    return results;
  }

  /**
   * Update a memory entry
   * @param id - The memory ID to update
   * @param updates - Partial updates to apply
   * @returns The updated memory entry or undefined if not found
   */
  update(id: string, updates: Partial<MemoryEntry>): MemoryEntry | undefined {
    const memory = this.memories.get(id);
    if (!memory) {
      return undefined;
    }

    // Apply updates (protect certain fields)
    const updatedMemory: MemoryEntry = {
      ...memory,
      ...updates,
      // Preserve these fields
      id: memory.id,
      createdAt: memory.createdAt,
    };

    this.memories.set(id, updatedMemory);
    return updatedMemory;
  }

  /**
   * Delete a memory entry
   * @param id - The memory ID to delete
   * @returns True if deleted, false if not found
   */
  delete(id: string): boolean {
    return this.memories.delete(id);
  }

  /**
   * Clear all memories
   */
  clear(): void {
    this.memories.clear();
  }

  /**
   * Get memory statistics
   * @returns Current memory statistics
   */
  getStats(): MemoryStats {
    const allMemories = this.memories.values();
    const countByType: Record<MemoryType, number> = {
      [MemoryType.SEMANTIC]: 0,
      [MemoryType.EPISODIC]: 0,
      [MemoryType.WORKING]: 0,
      [MemoryType.PROCEDURAL]: 0,
    };

    let totalImportance = 0;
    let memoryUsage = 0;

    for (const memory of allMemories) {
      countByType[memory.type]++;
      totalImportance += memory.importance;
      memoryUsage += JSON.stringify(memory).length;
    }

    return {
      totalMemories: this.memories.size(),
      countByType,
      memoryUsage,
      averageImportance: allMemories.length > 0 ? totalImportance / allMemories.length : 0,
    };
  }

  /**
   * Add episodic memory from chat messages
   * @param messages - Array of chat messages
   * @param importance - Importance score for this episode (0-1)
   * @returns The stored memory entry
   */
  addEpisode(messages: ChatMessage[], importance: number = 0.5): MemoryEntry {
    const episodeContent = this.formatEpisode(messages);
    const tokensUsed = this.tokenCounter.countMessages(messages);

    return this.store({
      type: MemoryType.EPISODIC,
      content: episodeContent,
      importance: Math.max(0, Math.min(1, importance)),
      tags: ['episode', 'conversation'],
      metadata: {
        messageCount: messages.length,
        tokenCount: tokensUsed.total,
      },
    });
  }

  /**
   * Format chat messages into an episodic memory string
   * @param messages - Array of chat messages
   * @returns Formatted episode string
   */
  private formatEpisode(messages: ChatMessage[]): string {
    return messages
      .map(msg => `[${msg.role}]: ${msg.content}`)
      .join('\n');
  }

  /**
   * Retrieve relevant memories for context injection
   * @param query - The current query/context
   * @param limit - Maximum number of memories to retrieve
   * @returns Array of relevant memory entries
   */
  getRelevantMemories(query: string, limit: number = 5): MemoryEntry[] {
    return this.search({
      query,
      limit,
      minImportance: 0.3,
    });
  }

  /**
   * Prune old/unimportant memories to manage space
   * @param targetSize - Target number of memories to keep (default: 1000)
   * @param minImportance - Minimum importance threshold to keep (default: 0.2)
   * @returns Number of memories pruned
   */
  prune(targetSize: number = 1000, minImportance: number = 0.2): number {
    const currentSize = this.memories.size();

    if (currentSize <= targetSize) {
      return 0;
    }

    const allMemories = this.memories.values();

    // Sort by importance (ascending) and last accessed (ascending)
    const toPrune = [...allMemories]
      .filter(m => m.importance < minImportance)
      .sort((a, b) => {
        if (a.importance !== b.importance) {
          return a.importance - b.importance;
        }
        return a.lastAccessed.getTime() - b.lastAccessed.getTime();
      })
      .slice(0, currentSize - targetSize);

    let prunedCount = 0;
    for (const memory of toPrune) {
      if (this.delete(memory.id)) {
        prunedCount++;
      }
    }

    return prunedCount;
  }

  /**
   * Export all memories
   * @returns Array of all memory entries
   */
  export(): MemoryEntry[] {
    return this.memories.values();
  }

  /**
   * Import memories
   * @param memories - Array of memory entries to import
   * @returns Number of memories imported
   */
  import(memories: MemoryEntry[]): number {
    let importedCount = 0;

    for (const memory of memories) {
      // Generate new ID to avoid conflicts
      const importedMemory: MemoryEntry = {
        ...memory,
        id: uuidv4(),
        createdAt: new Date(),
        lastAccessed: new Date(),
        accessCount: 0,
      };

      this.memories.set(importedMemory.id, importedMemory);
      importedCount++;
    }

    return importedCount;
  }

  /**
   * Record token usage from an operation
   * @param promptTokens - Tokens used in the input prompt
   * @param completionTokens - Tokens used in the completion
   */
  recordTokenUsage(promptTokens: number, completionTokens: number): void {
    this.tokenStats.input += promptTokens;
    this.tokenStats.output += completionTokens;
    this.tokenStats.total += promptTokens + completionTokens;
    this.tokenStats.lastUpdated = new Date();
  }

  /**
   * Get current token statistics
   * @returns Current token usage statistics
   */
  getTokenStats(): TokenStats {
    return { ...this.tokenStats };
  }

  /**
   * Count tokens in a text string
   * @param text - Text to count tokens in
   * @returns Estimated token count
   */
  countTokens(text: string): number {
    return this.tokenCounter.countText(text);
  }

  /**
   * Count tokens in an array of chat messages
   * @param messages - Array of chat messages
   * @returns Token count result with breakdowns
   */
  countMessages(messages: ChatMessage[]): ReturnType<TokenCounter['countMessages']> {
    return this.tokenCounter.countMessages(messages);
  }

  /**
   * Get the internal token counter instance
   * @returns The TokenCounter instance
   */
  getTokenCounter(): TokenCounter {
    return this.tokenCounter;
  }

  /**
   * Get the internal session store instance
   * @returns The SessionStore instance
   */
  getSessionStore(): SessionStore<string, MemoryEntry> {
    return this.memories;
  }
}
