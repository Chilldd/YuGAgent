/**
 * File Read Tool
 * Reads file contents with support for line ranges
 */

import { readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { resolve, normalize } from 'node:path';
import { validateAndResolvePath, validateLineRange } from '../utils/path-validator.js';

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

  /**
   * 检查文本是否包含乱码替换字符
   * @param text - 文本内容
   * @returns 是否包含替换字符
   */
  private hasReplacementCharacter(text: string): boolean {
    return text.includes('�');
  }

  /**
   * 使用自动回退策略解码文件内容
   * @param buffer - 文件原始字节
   * @param encoding - 用户指定编码
   * @returns 解码后的文本
   */
  private decodeContent(buffer: Buffer, encoding: BufferEncoding): string {
    // step1. 非 UTF-8 编码遵循用户参数直接解码
    if (encoding !== 'utf8') {
      return buffer.toString(encoding);
    }

    // step2. 先按 UTF-8 解码
    const utf8Content = buffer.toString('utf8');
    if (!this.hasReplacementCharacter(utf8Content)) {
      return utf8Content;
    }

    // step3. UTF-8 出现乱码时，尝试 GBK 回退（兼容 Windows 常见编码）
    try {
      const gbkContent = new TextDecoder('gbk').decode(buffer);
      const utf8ReplacementCount = (utf8Content.match(/�/g) || []).length;
      const gbkReplacementCount = (gbkContent.match(/�/g) || []).length;

      if (gbkReplacementCount < utf8ReplacementCount) {
        return gbkContent;
      }
    } catch {
      // 忽略回退失败，保留 UTF-8
    }

    return utf8Content;
  }

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

    // step1. 验证路径
    const pathValidation = validateAndResolvePath(path, true, 'file');
    if (!pathValidation.isValid) {
      throw new Error(pathValidation.error);
    }
    const resolvedPath = pathValidation.resolvedPath!;

    // step2. 验证行范围参数
    const lineValidation = validateLineRange(startLine, endLine);
    if (!lineValidation.isValid) {
      throw new Error(lineValidation.error);
    }

    try {
      // step3. 读取文件内容
      const fileBuffer = await readFile(resolvedPath);
      const content = this.decodeContent(fileBuffer, encoding);
      const lines = content.length === 0 ? [] : content.split('\n');

      // step4. 检查文件大小（在读取后验证，避免过大的内容占用内存）
      const fileSize = fileBuffer.byteLength;
      if (fileSize > this.maxFileSize) {
        console.warn(`[FileReadTool] File too large: ${fileSize} bytes exceeds maximum of ${this.maxFileSize} bytes`);
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
        size: Buffer.byteLength(resultContent, 'utf8'),
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
