/**
 * @fileoverview Utility functions for tool executor
 * @module infrastructure/tool-executor/utils
 */

/**
 * Check if the current platform is Windows
 * @returns True if running on Windows
 */
export function isWindows(): boolean {
  return process.platform === 'win32';
}

/**
 * Check if the current platform is macOS
 * @returns True if running on macOS
 */
export function isMacOS(): boolean {
  return process.platform === 'darwin';
}

/**
 * Check if the current platform is Linux
 * @returns True if running on Linux
 */
export function isLinux(): boolean {
  return process.platform === 'linux';
}
