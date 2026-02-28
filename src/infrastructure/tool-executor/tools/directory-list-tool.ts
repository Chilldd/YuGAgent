/**
 * Directory List Tool
 * Lists directory contents with support for recursive traversal
 */

import { readdir, stat } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { resolve, normalize, join } from 'node:path';
import { validateAndResolvePath } from '../utils/path-validator.js';

/**
 * Directory entry information
 */
export interface DirectoryEntry {
  /** Entry name */
  name: string;

  /** Full path to the entry */
  path: string;

  /** Entry type */
  type: 'file' | 'directory' | 'symlink';

  /** Size in bytes (files only) */
  size?: number;

  /** Last modified timestamp */
  modifiedTime: Date;

  /** Whether the entry is hidden */
  hidden: boolean;
}

/**
 * Directory list tool parameters
 */
export interface DirectoryListToolParameters {
  /** Path to the directory */
  path: string;

  /** Whether to list recursively */
  recursive?: boolean;

  /** Whether to show hidden files (starting with .) */
  showHidden?: boolean;

  /** Maximum depth for recursive listing (default: 10) */
  maxDepth?: number;
}

/**
 * Directory list tool result
 */
export interface DirectoryListToolResult {
  /** List of directory entries */
  entries: DirectoryEntry[];

  /** Total number of entries */
  count: number;

  /** Total size in bytes (files only) */
  totalSize: number;

  /** Whether the result was truncated due to max depth */
  truncated: boolean;
}

/**
 * DirectoryListTool class for listing directory contents
 */
export class DirectoryListTool {
  private maxEntries: number;
  private maxDepth: number;

  constructor(maxEntries: number = 10000, maxDepth: number = 10) {
    this.maxEntries = maxEntries;
    this.maxDepth = maxDepth;
  }

  /**
   * List a directory
   * @param parameters - The directory list parameters
   * @returns Promise resolving to the directory list result
   */
  async execute(parameters: DirectoryListToolParameters): Promise<DirectoryListToolResult> {
    const { path, recursive = false, showHidden = false, maxDepth } = parameters;

    // step1. 验证路径
    const pathValidation = validateAndResolvePath(path, true, 'directory');
    if (!pathValidation.isValid) {
      throw new Error(pathValidation.error);
    }
    const resolvedPath = pathValidation.resolvedPath!;

    // step2. 检查路径是否为目录
    const pathStat = await stat(resolvedPath);
    if (!pathStat.isDirectory()) {
      throw new Error(`Path is not a directory: ${resolvedPath}`);
    }

    // step3. 验证深度限制
    const depthLimit = maxDepth ?? this.maxDepth;
    if (depthLimit < 0 || depthLimit > 100) {
      throw new Error('maxDepth must be between 0 and 100');
    }

    const entries: DirectoryEntry[] = [];
    let wasTruncated = false;

    // Recursively list directory
    wasTruncated = await this.listDirectory(
      resolvedPath,
      resolvedPath,
      recursive,
      showHidden,
      0,
      depthLimit,
      entries
    );

    // Calculate total size
    const totalSize = entries.reduce((sum, entry) => sum + (entry.size || 0), 0);

    return {
      entries,
      count: entries.length,
      totalSize,
      truncated: wasTruncated,
    };
  }

  /**
   * Recursively list a directory
   * @param basePath - Base path for resolving relative paths
   * @param currentPath - Current directory path
   * @param recursive - Whether to list recursively
   * @param showHidden - Whether to show hidden files
   * @param currentDepth - Current recursion depth
   * @param maxDepth - Maximum recursion depth
   * @param entries - Array to collect entries
   * @returns Whether traversal was truncated by depth or max entries limits
   */
  private async listDirectory(
    basePath: string,
    currentPath: string,
    recursive: boolean,
    showHidden: boolean,
    currentDepth: number,
    maxDepth: number,
    entries: DirectoryEntry[]
  ): Promise<boolean> {
    let truncated = false;

    // Check max depth
    if (currentDepth >= maxDepth) {
      return true;
    }

    // Check max entries
    if (entries.length >= this.maxEntries) {
      return true;
    }

    try {
      const dirents = await readdir(currentPath, { withFileTypes: true });

      for (const dirent of dirents) {
        // Check max entries again
        if (entries.length >= this.maxEntries) {
          truncated = true;
          break;
        }

        const name = dirent.name;
        const fullPath = join(currentPath, name);
        const relativePath = fullPath.substring(basePath.length);

        // Filter hidden files
        const isHidden = name.startsWith('.');
        if (!showHidden && isHidden) {
          continue;
        }

        // Get entry info
        try {
          const entryStat = await stat(fullPath);

          const entry: DirectoryEntry = {
            name,
            path: relativePath || '/',
            type: dirent.isSymbolicLink() ? 'symlink' : dirent.isDirectory() ? 'directory' : 'file',
            size: dirent.isFile() ? entryStat.size : undefined,
            modifiedTime: entryStat.mtime,
            hidden: isHidden,
          };

          entries.push(entry);

          // Recursively list subdirectories
          if (recursive && dirent.isDirectory()) {
            const childTruncated = await this.listDirectory(
              basePath,
              fullPath,
              recursive,
              showHidden,
              currentDepth + 1,
              maxDepth,
              entries
            );
            truncated = truncated || childTruncated;
          }
        } catch (error: any) {
          // Skip entries that can't be accessed
          if (error.code !== 'EACCES' && error.code !== 'ENOENT') {
            throw error;
          }
        }
      }
    } catch (error: any) {
      if (error.code === 'EACCES') {
        throw new Error(`Permission denied: ${currentPath}`);
      }
      throw error;
    }

    return truncated;
  }

  /**
   * Get the tool definition
   * @returns The tool definition
   */
  getDefinition() {
    return {
      name: 'directory-list',
      description: 'List directory contents with optional recursive traversal',
      inputSchema: {
        type: 'object' as const,
        properties: {
          path: {
            type: 'string',
            description: 'Absolute path to the directory',
          },
          recursive: {
            type: 'boolean',
            description: 'Whether to list recursively (default: false)',
          },
          showHidden: {
            type: 'boolean',
            description: 'Whether to show hidden files starting with . (default: false)',
          },
          maxDepth: {
            type: 'number',
            description: 'Maximum depth for recursive listing (default: 10)',
          },
        },
        required: ['path'],
      },
      requiresSecurityCheck: true,
    };
  }

  /**
   * Update configuration
   * @param maxEntries - New maximum number of entries
   * @param maxDepth - New maximum recursion depth
   */
  updateConfig(maxEntries?: number, maxDepth?: number): void {
    // step1. 验证 maxEntries 参数
    if (maxEntries !== undefined) {
      if (typeof maxEntries !== 'number' || maxEntries < 1 || maxEntries > 100000) {
        throw new Error('maxEntries must be a number between 1 and 100000');
      }
      this.maxEntries = maxEntries;
    }

    // step2. 验证 maxDepth 参数
    if (maxDepth !== undefined) {
      if (typeof maxDepth !== 'number' || maxDepth < 0 || maxDepth > 100) {
        throw new Error('maxDepth must be a number between 0 and 100');
      }
      this.maxDepth = maxDepth;
    }
  }
}
