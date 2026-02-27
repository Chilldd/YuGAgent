/**
 * File Read Tool
 * Reads file contents with support for line ranges
 */

import { readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { resolve, normalize } from 'node:path';

/**
 * File read tool parameters
 */
export interface FileReadToolParameters {
  /** Path to the file to read */
  path: string;

  /** Character encoding (default: 'utf8') */
  encoding?: BufferEncoding;

  /** Start line number (1-indexed, inclusive) */
  startLine?: number;

  /** End line number (1-indexed, inclusive) */
  endLine?: number;
}

/**
 * File read tool result
 */
export interface FileReadToolResult {
  /** The file content */
  content: string;

  /** Number of lines read */
  lines: number;

  /** File size in bytes */
  size: number;

  /** Whether the result is truncated */
  truncated: boolean;

  /** Actual line range read */
  range: {
    start: number;
    end: number;
  };
}

/**
 * FileReadTool class for reading file contents
 */
export class FileReadTool {
  private maxFileSize: number;

  private countLines(content: string): number {
    return content.length === 0 ? 0 : content.split('\n').length;
  }

  constructor(maxFileSize: number = 10 * 1024 * 1024) { // 10MB default
    this.maxFileSize = maxFileSize;
  }

  /**
   * Read a file
   * @param parameters - The file read parameters
   * @returns Promise resolving to the file read result
   */
  async execute(parameters: FileReadToolParameters): Promise<FileReadToolResult> {
    const { path, encoding = 'utf8', startLine, endLine } = parameters;

    // Resolve and normalize the path
    const resolvedPath = resolve(normalize(path));

    // Check if file exists
    if (!existsSync(resolvedPath)) {
      throw new Error(`File not found: ${resolvedPath}`);
    }

    // Validate line range
    if (startLine !== undefined && startLine < 1) {
      throw new Error('startLine must be >= 1');
    }

    if (endLine !== undefined && startLine !== undefined && endLine < startLine) {
      throw new Error('endLine must be >= startLine');
    }

    try {
      // Read the file
      const content = await readFile(resolvedPath, { encoding });
      const lines = content.length === 0 ? [] : content.split('\n');

      // Check file size
      const fileSize = Buffer.byteLength(content, encoding);
      if (fileSize > this.maxFileSize) {
        throw new Error(
          `File too large: ${fileSize} bytes exceeds maximum of ${this.maxFileSize} bytes`
        );
      }

      // Apply line range filter if specified
      let resultContent: string;
      let actualRange: { start: number; end: number };

      if (startLine !== undefined || endLine !== undefined) {
        const start = startLine || 1;
        const end = endLine || lines.length;

        // Convert to 0-indexed
        const startIndex = Math.max(0, start - 1);
        const endIndex = Math.min(lines.length, end);

        const selectedLines = lines.slice(startIndex, endIndex);
        resultContent = selectedLines.join('\n');
        actualRange = selectedLines.length === 0
          ? { start: 0, end: 0 }
          : { start: startIndex + 1, end: endIndex };
      } else {
        resultContent = content;
        actualRange = lines.length === 0 ? { start: 0, end: 0 } : { start: 1, end: lines.length };
      }

      return {
        content: resultContent,
        lines: this.countLines(resultContent),
        size: Buffer.byteLength(resultContent, encoding),
        truncated: false,
        range: actualRange,
      };
    } catch (error: any) {
      if (error.code === 'EISDIR') {
        throw new Error(`Path is a directory, not a file: ${resolvedPath}`);
      }
      if (error.code === 'EACCES') {
        throw new Error(`Permission denied: ${resolvedPath}`);
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
      name: 'file-read',
      description: 'Read the contents of a file with optional line range filtering',
      inputSchema: {
        type: 'object' as const,
        properties: {
          path: {
            type: 'string',
            description: 'Absolute path to the file to read',
          },
          encoding: {
            type: 'string',
            description: 'Character encoding (default: utf8)',
            enum: ['utf8', 'utf16le', 'latin1', 'ascii', 'base64', 'hex'],
          },
          startLine: {
            type: 'number',
            description: 'Start line number (1-indexed, inclusive)',
          },
          endLine: {
            type: 'number',
            description: 'End line number (1-indexed, inclusive)',
          },
        },
        required: ['path'],
      },
      requiresSecurityCheck: true,
    };
  }

  /**
   * Update the maximum file size
   * @param maxFileSize - New maximum file size in bytes
   */
  updateMaxFileSize(maxFileSize: number): void {
    this.maxFileSize = maxFileSize;
  }
}
