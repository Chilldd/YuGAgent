/**
 * @fileoverview Domain types for Memory management
 * @module domain/memory/types
 */

import type { ChatMessage } from '../agent/types.js';

/**
 * Memory entry types
 */
export enum MemoryType {
  /** Semantic memory - facts and knowledge */
  SEMANTIC = 'semantic',
  /** Episodic memory - conversation history */
  EPISODIC = 'episodic',
  /** Working memory - current task context */
  WORKING = 'working',
  /** Procedural memory - skills and procedures */
  PROCEDURAL = 'procedural',
}

/**
 * A memory entry
 */
export interface MemoryEntry {
  /** Unique identifier for the memory */
  id: string;
  /** Type of memory */
  type: MemoryType;
  /** Memory content */
  content: string;
  /** When the memory was created */
  createdAt: Date;
  /** When the memory was last accessed */
  lastAccessed: Date;
  /** Access count for popularity tracking */
  accessCount: number;
  /** Importance score (0-1) */
  importance: number;
  /** Associated tags for retrieval */
  tags: string[];
  /** Optional metadata */
  metadata?: Record<string, unknown>;
}

/**
 * Memory retrieval options
 */
export interface MemoryRetrievalOptions {
  /** Maximum number of memories to retrieve */
  limit?: number;
  /** Minimum importance threshold */
  minImportance?: number;
  /** Filter by memory type */
  type?: MemoryType;
  /** Filter by tags */
  tags?: string[];
  /** Semantic search query */
  query?: string;
}

/**
 * Memory statistics
 */
export interface MemoryStats {
  /** Total number of memories stored */
  totalMemories: number;
  /** Count by memory type */
  countByType: Record<MemoryType, number>;
  /** Total memory usage in bytes */
  memoryUsage: number;
  /** Average importance score */
  averageImportance: number;
}

/**
 * Memory manager interface for handling conversation memory
 */
export interface IMemoryManager {
  /**
   * Store a memory
   * @param entry - The memory entry to store
   * @returns The stored memory entry with generated ID
   */
  store(entry: Omit<MemoryEntry, 'id' | 'createdAt' | 'lastAccessed' | 'accessCount'>): MemoryEntry;

  /**
   * Retrieve a memory by ID
   * @param id - The memory ID
   * @returns The memory entry or undefined if not found
   */
  retrieve(id: string): MemoryEntry | undefined;

  /**
   * Search for memories based on criteria
   * @param options - Retrieval options
   * @returns Array of matching memory entries
   */
  search(options: MemoryRetrievalOptions): MemoryEntry[];

  /**
   * Update a memory entry
   * @param id - The memory ID to update
   * @param updates - Partial updates to apply
   * @returns The updated memory entry or undefined if not found
   */
  update(id: string, updates: Partial<MemoryEntry>): MemoryEntry | undefined;

  /**
   * Delete a memory entry
   * @param id - The memory ID to delete
   * @returns True if deleted, false if not found
   */
  delete(id: string): boolean;

  /**
   * Clear all memories
   */
  clear(): void;

  /**
   * Get memory statistics
   * @returns Current memory statistics
   */
  getStats(): MemoryStats;

  /**
   * Add episodic memory from chat messages
   * @param messages - Array of chat messages
   * @param importance - Importance score for this episode
   * @returns The stored memory entry
   */
  addEpisode(messages: ChatMessage[], importance?: number): MemoryEntry;

  /**
   * Retrieve relevant memories for context injection
   * @param query - The current query/context
   * @param limit - Maximum number of memories to retrieve
   * @returns Array of relevant memory entries
   */
  getRelevantMemories(query: string, limit?: number): MemoryEntry[];

  /**
   * Prune old/unimportant memories to manage space
   * @param targetSize - Target number of memories to keep
   * @param minImportance - Minimum importance threshold to keep
   * @returns Number of memories pruned
   */
  prune(targetSize?: number, minImportance?: number): number;

  /**
   * Export all memories
   * @returns Array of all memory entries
   */
  export(): MemoryEntry[];

  /**
   * Import memories
   * @param memories - Array of memory entries to import
   * @returns Number of memories imported
   */
  import(memories: MemoryEntry[]): number;
}
