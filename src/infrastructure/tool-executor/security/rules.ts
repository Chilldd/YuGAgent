/**
 * Built-in Security Rules
 * Predefined security rules for common dangerous operations
 */

import type { SecurityRule, ToolExecuteRequest } from '../interface';

/**
 * Detects if a command attempts to delete root directory or system-critical paths
 */
function detectRootDelete(command: string): boolean {
  const dangerousPatterns = [
    /rm\s+[-rf]+\s+\/$/,
    /rm\s+[-rf]+\s+\/\s/,
    /del\s+\/[sS]\s+[a-zA-Z]:\\/,
    /rmdir\/[sS]\s+\/[qQ]\s+[a-zA-Z]:\\/,
    /rm\s+[-rf]+\s+\/\*/,           // rm -rf /*
    /rm\s+[-rf]+\s+\/\./,           // rm -rf /.
    /rm\s+[-rf]+\s+\\/,             // Windows rm -rf \
  ];
  return dangerousPatterns.some(pattern => pattern.test(command));
}

/**
 * Detects command injection attempts through various means
 */
function detectCommandInjection(command: string): boolean {
  const injectionPatterns = [
    /\$\([^)]*\)/,                  // $(command)
    /`[^`]*`/,                      // `command`
    /\|\s*\w+/,                     // pipe to command
    /;\s*\w+/,                      // command chaining
    /&&\s*\w+/,                     // AND execution
    /\|\|\s*\w+/,                   // OR execution
    />>\s*\w+/,                     // append redirection
    />\s*\/dev\/[a-z]+/,           // device redirection
    /\${[^}]*}/,                    // ${var} expansion
  ];
  return injectionPatterns.some(pattern => pattern.test(command));
}

/**
 * Detects git force push operations
 */
function detectGitForcePush(command: string): boolean {
  return /git\s+push\s+(-f|--force|--force-with-lease)/.test(command);
}

/**
 * Detects disk formatting operations
 */
function detectDiskFormat(command: string): boolean {
  const formatPatterns = [
    /format\s+[a-zA-Z]:/,
    /mkfs\./,
    /diskutil\s+eraseDisk/,
  ];
  return formatPatterns.some(pattern => pattern.test(command));
}

/**
 * Detects sudo or privilege escalation attempts
 */
function detectSudoUsage(command: string): boolean {
  return /^\s*sudo\s+/.test(command);
}

/**
 * Detects SSH key reading attempts
 */
function detectSSHKeyRead(command: string): boolean {
  const sshKeyPatterns = [
    /cat\s+.*\/\.ssh\/id_[a-z]+/,
    /cat\s+.*\/\.ssh\/[a-z]+_key/,
    /cat\s+.*\/ssh\/.*_key/,
  ];
  return sshKeyPatterns.some(pattern => pattern.test(command));
}

/**
 * Detects .env file reading attempts
 */
function detectEnvRead(command: string): boolean {
  return /cat\s+.*\.env/.test(command) ||
         /type\s+.*\.env/.test(command) ||
         /more\s+.*\.env/.test(command);
}

/**
 * Detects attempts to read password files
 */
function detectPasswordFileRead(command: string): boolean {
  const passwordPatterns = [
    /cat\s+\/etc\/passwd/,
    /cat\s+\/etc\/shadow/,
    /cat\s+\/etc\/master\.passwd/,
  ];
  return passwordPatterns.some(pattern => pattern.test(command));
}

/**
 * Detects destructive git operations
 */
function detectDestructiveGitOperation(command: string): boolean {
  const destructivePatterns = [
    /git\s+reset\s+--hard/,
    /git\s+clean\s+-fd/,
    /git\s+branch\s+-D/,
  ];
  return destructivePatterns.some(pattern => pattern.test(command));
}

/**
 * Detects package management with dangerous flags
 */
function detectDangerousPackageOperation(command: string): boolean {
  const dangerousPatterns = [
    /npm\s+uninstall\s+.*--global/,
    /yarn\s+global\s+remove/,
    /pip\s+uninstall\s+-y\s+.*pip/,
    /rm\s+-rf\s+.*node_modules/,
  ];
  return dangerousPatterns.some(pattern => pattern.test(command));
}

/**
 * Built-in security rules for terminal operations
 */
export const BUILT_IN_SECURITY_RULES: SecurityRule[] = [
  {
    id: 'no-root-delete',
    description: 'Prohibit deletion of root directory or system-critical paths',
    severity: 'critical',
    enabled: true,
    validate: (request: ToolExecuteRequest) => {
      if (request.toolName === 'terminal' && request.parameters?.command) {
        const command = request.parameters.command as string;
        if (detectRootDelete(command)) {
          return {
            passed: false,
            error: 'Cannot execute command: deletion of root directory is prohibited for security reasons',
          };
        }
      }
      return { passed: true };
    },
  },
  {
    id: 'no-command-injection',
    description: 'Prohibit command injection attempts',
    severity: 'critical',
    enabled: true,
    validate: (request: ToolExecuteRequest) => {
      if (request.toolName === 'terminal' && request.parameters?.command) {
        const command = request.parameters.command as string;
        if (detectCommandInjection(command)) {
          return {
            passed: false,
            error: 'Cannot execute command: command injection patterns are prohibited for security reasons',
          };
        }
      }
      return { passed: true };
    },
  },
  {
    id: 'no-git-force-push',
    description: 'Prohibit git force push operations',
    severity: 'high',
    enabled: true,
    validate: (request: ToolExecuteRequest) => {
      if (request.toolName === 'terminal' && request.parameters?.command) {
        const command = request.parameters.command as string;
        if (detectGitForcePush(command)) {
          return {
            passed: false,
            error: 'Cannot execute command: git force push is prohibited to prevent remote branch disruption',
          };
        }
      }
      return { passed: true };
    },
  },
  {
    id: 'no-disk-format',
    description: 'Prohibit disk formatting operations',
    severity: 'critical',
    enabled: true,
    validate: (request: ToolExecuteRequest) => {
      if (request.toolName === 'terminal' && request.parameters?.command) {
        const command = request.parameters.command as string;
        if (detectDiskFormat(command)) {
          return {
            passed: false,
            error: 'Cannot execute command: disk formatting is prohibited',
          };
        }
      }
      return { passed: true };
    },
  },
  {
    id: 'no-sudo',
    description: 'Prohibit sudo and privilege escalation attempts',
    severity: 'high',
    enabled: true,
    validate: (request: ToolExecuteRequest) => {
      if (request.toolName === 'terminal' && request.parameters?.command) {
        const command = request.parameters.command as string;
        if (detectSudoUsage(command)) {
          return {
            passed: false,
            error: 'Cannot execute command: sudo and privilege escalation are prohibited',
          };
        }
      }
      return { passed: true };
    },
  },
  {
    id: 'no-ssh-key-read',
    description: 'Prohibit reading SSH private keys',
    severity: 'high',
    enabled: true,
    validate: (request: ToolExecuteRequest) => {
      if (request.toolName === 'terminal' && request.parameters?.command) {
        const command = request.parameters.command as string;
        if (detectSSHKeyRead(command)) {
          return {
            passed: false,
            error: 'Cannot execute command: reading SSH private keys is prohibited',
          };
        }
      }
      return { passed: true };
    },
  },
  {
    id: 'no-env-read',
    description: 'Prohibit reading .env files through terminal',
    severity: 'medium',
    enabled: true,
    validate: (request: ToolExecuteRequest) => {
      if (request.toolName === 'terminal' && request.parameters?.command) {
        const command = request.parameters.command as string;
        if (detectEnvRead(command)) {
          return {
            passed: false,
            error: 'Cannot execute command: reading .env files through terminal is prohibited. Use dedicated environment tools instead.',
          };
        }
      }
      return { passed: true };
    },
  },
  {
    id: 'no-password-file-read',
    description: 'Prohibit reading system password files',
    severity: 'high',
    enabled: true,
    validate: (request: ToolExecuteRequest) => {
      if (request.toolName === 'terminal' && request.parameters?.command) {
        const command = request.parameters.command as string;
        if (detectPasswordFileRead(command)) {
          return {
            passed: false,
            error: 'Cannot execute command: reading system password files is prohibited',
          };
        }
      }
      return { passed: true };
    },
  },
  {
    id: 'no-destructive-git',
    description: 'Warn about destructive git operations',
    severity: 'medium',
    enabled: true,
    validate: (request: ToolExecuteRequest) => {
      if (request.toolName === 'terminal' && request.parameters?.command) {
        const command = request.parameters.command as string;
        if (detectDestructiveGitOperation(command)) {
          return {
            passed: false,
            error: 'Cannot execute command: destructive git operations (reset --hard, clean -fd, branch -D) are prohibited',
          };
        }
      }
      return { passed: true };
    },
  },
  {
    id: 'no-dangerous-package-ops',
    description: 'Prohibit dangerous package management operations',
    severity: 'medium',
    enabled: true,
    validate: (request: ToolExecuteRequest) => {
      if (request.toolName === 'terminal' && request.parameters?.command) {
        const command = request.parameters.command as string;
        if (detectDangerousPackageOperation(command)) {
          return {
            passed: false,
            error: 'Cannot execute command: dangerous package management operations are prohibited',
          };
        }
      }
      return { passed: true };
    },
  },
];

/**
 * Security rules for file operations
 */
export const FILE_SECURITY_RULES: SecurityRule[] = [
  {
    id: 'no-ssh-key-file-read',
    description: 'Prohibit reading SSH private key files directly',
    severity: 'high',
    enabled: true,
    validate: (request: ToolExecuteRequest) => {
      if (request.toolName === 'file-read' && request.parameters?.path) {
        const path = request.parameters.path as string;
        if (path.includes('.ssh') && (path.includes('id_') || path.includes('_key'))) {
          return {
            passed: false,
            error: 'Cannot read file: SSH private key files are protected',
          };
        }
      }
      return { passed: true };
    },
  },
  {
    id: 'no-path-traversal-directory',
    description: 'Prohibit path traversal attempts in directory listing',
    severity: 'high',
    enabled: true,
    validate: (request: ToolExecuteRequest) => {
      if (request.toolName === 'directory-list' && request.parameters?.path) {
        const path = request.parameters.path as string;
        // 检查路径遍历模式
        const traversalPatterns = [
          /\.\.[\/\\]/,        // ../ 或 ..\
          /\.\.$/,             // 以 .. 结尾
          /%2e%2e/i,           // URL 编码的 ..
        ];
        if (traversalPatterns.some(pattern => pattern.test(path))) {
          return {
            passed: false,
            error: 'Cannot list directory: path traversal sequences are not allowed',
          };
        }
      }
      return { passed: true };
    },
  },
  {
    id: 'no-env-file-read',
    description: 'Prohibit reading .env files directly',
    severity: 'medium',
    enabled: true,
    validate: (request: ToolExecuteRequest) => {
      if (request.toolName === 'file-read' && request.parameters?.path) {
        const path = request.parameters.path as string;
        const fileName = path.split('/').pop() || path.split('\\').pop() || '';
        if (fileName === '.env' || fileName.endsWith('.env.local') || fileName.endsWith('.env.production')) {
          return {
            passed: false,
            error: 'Cannot read file: .env files are protected. Use dedicated environment tools instead.',
          };
        }
      }
      return { passed: true };
    },
  },
  {
    id: 'no-system-critical-file-read',
    description: 'Prohibit reading system-critical files',
    severity: 'high',
    enabled: true,
    validate: (request: ToolExecuteRequest) => {
      if (request.toolName === 'file-read' && request.parameters?.path) {
        const path = request.parameters.path as string;
        const criticalPaths = ['/etc/passwd', '/etc/shadow', '/etc/master.passwd'];
        if (criticalPaths.some(criticalPath => path.includes(criticalPath))) {
          return {
            passed: false,
            error: 'Cannot read file: system-critical files are protected',
          };
        }
      }
      return { passed: true };
    },
  },
  {
    id: 'no-path-traversal',
    description: 'Prohibit path traversal attempts in file operations',
    severity: 'high',
    enabled: true,
    validate: (request: ToolExecuteRequest) => {
      if (request.toolName === 'file-read' && request.parameters?.path) {
        const path = request.parameters.path as string;
        // 检查路径遍历模式
        const traversalPatterns = [
          /\.\.[\/\\]/,        // ../ 或 ..\
          /\.\.$/,             // 以 .. 结尾
          /%2e%2e/i,           // URL 编码的 ..
          /%252e/i,           // 双重 URL 编码
          /\.\.%5c/i,          // ..%5c (编码的 \)
          /\.\.%2f/i,          // ..%2f (编码的 /)
        ];
        if (traversalPatterns.some(pattern => pattern.test(path))) {
          return {
            passed: false,
            error: 'Cannot read file: path traversal sequences are not allowed',
          };
        }
      }
      return { passed: true };
    },
  },
];

/**
 * Get all built-in security rules
 */
export function getAllBuiltInRules(): SecurityRule[] {
  return [...BUILT_IN_SECURITY_RULES, ...FILE_SECURITY_RULES];
}
