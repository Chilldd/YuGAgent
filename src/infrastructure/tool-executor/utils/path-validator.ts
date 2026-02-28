/**
 * @fileoverview Path validation utilities for tool security
 * @module infrastructure/tool-executor/utils/path-validator
 */

import { existsSync } from 'node:fs';
import { normalize, resolve } from 'node:path';

/**
 * Maximum allowed path length to prevent DoS attacks
 */
export const MAX_PATH_LENGTH = 1000;

/**
 * Path validation result
 */
export interface PathValidationResult {
  /** Whether the path is valid */
  isValid: boolean;
  /** Normalized resolved path */
  resolvedPath?: string;
  /** Error message if validation failed */
  error?: string;
}

/**
 * Validate and resolve a file system path
 *
 * Performs the following security checks:
 * - Path length limit (prevents DoS)
 * - Path traversal prevention (blocks .. sequences)
 * - Path existence check
 *
 * @param rawPath - The raw path to validate
 * @param checkExists - Whether to check if the path exists (default: true)
 * @param pathType - Type of path for error messages ('file' or 'directory')
 * @returns Validation result with resolved path or error
 */
export function validateAndResolvePath(
  rawPath: string,
  checkExists = true,
  pathType: 'file' | 'directory' = 'file'
): PathValidationResult {
  // step1. 验证路径长度
  if (rawPath.length > MAX_PATH_LENGTH) {
    return {
      isValid: false,
      error: 'Path exceeds maximum length',
    };
  }

  // step2. 解析并规范化路径
  const resolvedPath = resolve(normalize(rawPath));

  // step3. 检查路径遍历攻击
  const normalizedPath = normalize(rawPath);
  if (normalizedPath.includes('..')) {
    return {
      isValid: false,
      error: 'Path contains parent directory references (..) which are not allowed',
    };
  }

  // step4. 检查路径是否存在
  if (checkExists && !existsSync(resolvedPath)) {
    return {
      isValid: false,
      error: `${pathType === 'file' ? 'File' : 'Directory'} not found: ${resolvedPath}`,
    };
  }

  return {
    isValid: true,
    resolvedPath,
  };
}

/**
 * Validate line number parameters
 *
 * @param startLine - Starting line number (1-indexed)
 * @param endLine - Ending line number (1-indexed)
 * @returns Validation result
 */
export function validateLineRange(startLine?: number, endLine?: number): { isValid: boolean; error?: string } {
  // step1. 验证起始行
  if (startLine !== undefined && startLine < 1) {
    return { isValid: false, error: 'startLine must be >= 1' };
  }

  // step2. 验证结束行
  if (endLine !== undefined && endLine < 1) {
    return { isValid: false, error: 'endLine must be >= 1' };
  }

  // step3. 验证行范围顺序
  if (startLine !== undefined && endLine !== undefined && endLine < startLine) {
    return { isValid: false, error: 'endLine must be >= startLine' };
  }

  // step4. 验证行数范围合理性
  const MAX_REASONABLE_LINE = 10_000_000;
  if (startLine !== undefined && startLine > MAX_REASONABLE_LINE) {
    return { isValid: false, error: 'startLine exceeds reasonable maximum' };
  }

  if (endLine !== undefined && endLine > MAX_REASONABLE_LINE) {
    return { isValid: false, error: 'endLine exceeds reasonable maximum' };
  }

  return { isValid: true };
}
