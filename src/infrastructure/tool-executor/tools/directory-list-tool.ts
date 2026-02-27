/**
 * Directory List Tool
 * Lists directory contents with support for recursive traversal
 */

import { readdir, stat } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { resolve, normalize, join } from 'node:path';

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

    // Resolve and normalize the path
    const resolvedPath = resolve(normalize(path));

    // Check if directory exists
    if (!existsSync(resolvedPath)) {
      throw new Error(`Directory not found: ${resolvedPath}`);
    }

    // Check if path is a directory
    const pathStat = await stat(resolvedPath);
    if (!pathStat.isDirectory()) {
      throw new Error(`Path is not a directory: ${resolvedPath}`);
    }

    const depthLimit = maxDepth ?? this.maxDepth;
    const entries: DirectoryEntry[] = [];
    let totalSize = 0;

    // Recursively list directory
    await this.listDirectory(
      resolvedPath,
      resolvedPath,
      recursive,
      showHidden,
      0,
      depthLimit,
      entries,
      totalSize
    );

    // Calculate total size
    totalSize = entries.reduce((sum, entry) => sum + (entry.size || 0), 0);

    return {
      entries,
      count: entries.length,
      totalSize,
      truncated: false,
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
   * @param totalSize - Running total of file sizes
   */
  private async listDirectory(
    basePath: string,
    currentPath: string,
    recursive: boolean,
    showHidden: boolean,
    currentDepth: number,
    maxDepth: number,
    entries: DirectoryEntry[],
    totalSize: number
  ): Promise<void> {
    // Check max depth
    if (currentDepth >= maxDepth) {
      return;
    }

    // Check max entries
    if (entries.length >= this.maxEntries) {
      return;
    }

    try {
      const dirents = await readdir(currentPath, { withFileTypes: true });

      for (const dirent of dirents) {
        // Check max entries again
        if (entries.length >= this.maxEntries) {
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
          if (recursive && dirent.isDirectory() && !isHidden) {
            await this.listDirectory(
              basePath,
              fullPath,
              recursive,
              showHidden,
              currentDepth + 1,
              maxDepth,
              entries,
              totalSize
            );
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
    if (maxEntries !== undefined) {
      this.maxEntries = maxEntries;
    }
    if (maxDepth !== undefined) {
      this.maxDepth = maxDepth;
    }
  }
}
