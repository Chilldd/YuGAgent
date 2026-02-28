/**
 * Terminal Tool
 * Executes shell commands using child_process.exec
 */

import { exec } from 'node:child_process';
import { promisify } from 'node:util';
import { isWindows } from '../utils.js';

const execAsync = promisify(exec);

/**
 * Terminal tool configuration
 */
export interface TerminalToolConfig {
  /** Maximum timeout for command execution (ms) */
  maxTimeout?: number;

  /** Maximum output size (bytes) */
  maxOutputSize?: number;

  /** Allowed working directories */
  allowedWorkingDirectories?: string[];

  /** Whether to allow shell metacharacters */
  allowShellMetacharacters?: boolean;
}

/**
 * Terminal tool parameters
 */
export interface TerminalToolParameters {
  /** The command to execute */
  command: string;

  /** Working directory for the command */
  cwd?: string;

  /** Timeout in milliseconds (default: 120000) */
  timeout?: number;

  /** Environment variables */
  env?: Record<string, string>;
}

/**
 * Terminal tool execution result
 */
export interface TerminalToolResult {
  /** Standard output */
  stdout: string;

  /** Standard error */
  stderr: string;

  /** Exit code */
  exitCode: number;

  /** Whether the command timed out */
  timedOut: boolean;

  /** Execution time in milliseconds */
  executionTime: number;
}

/**
 * TerminalTool class for executing shell commands
 */
export class TerminalTool {
  private config: Required<TerminalToolConfig>;

  /**
   * 检查文本中的乱码特征（Unicode 替换字符）
   * @param text - 待检查文本
   * @returns 是否包含乱码特征
   */
  private hasReplacementCharacter(text: string): boolean {
    return text.includes('�');
  }

  /**
   * 解码命令输出，优先 UTF-8，必要时在 Windows 下回退到 GBK
   * @param output - 原始输出（字符串或 Buffer）
   * @returns 解码后的文本
   */
  private decodeOutput(output: string | Buffer | undefined): string {
    if (!output) {
      return '';
    }

    if (typeof output === 'string') {
      return output;
    }

    // step1. 优先按 UTF-8 解码
    const utf8Text = output.toString('utf8');
    if (!this.hasReplacementCharacter(utf8Text)) {
      return utf8Text;
    }

    // step2. Windows 场景回退 GBK，减少中文乱码
    if (isWindows()) {
      try {
        const gbkText = new TextDecoder('gbk').decode(output);
        const utf8ReplacementCount = (utf8Text.match(/�/g) || []).length;
        const gbkReplacementCount = (gbkText.match(/�/g) || []).length;

        if (gbkReplacementCount < utf8ReplacementCount) {
          return gbkText;
        }
      } catch {
        // 忽略回退失败，保留 UTF-8 结果
      }
    }

    return utf8Text;
  }

  constructor(config: TerminalToolConfig = {}) {
    this.config = {
      maxTimeout: config.maxTimeout ?? 600000, // 10 minutes default
      maxOutputSize: config.maxOutputSize ?? 10 * 1024 * 1024, // 10MB default
      allowedWorkingDirectories: config.allowedWorkingDirectories ?? [],
      allowShellMetacharacters: config.allowShellMetacharacters ?? true,
    };
  }

  /**
   * Execute a terminal command
   * @param parameters - The command parameters
   * @returns Promise resolving to the execution result
   */
  async execute(parameters: TerminalToolParameters): Promise<TerminalToolResult> {
    const { command, cwd, timeout, env } = parameters;

    // step1. 验证命令是否有效
    this.validateCommand(command);

    // step2. 验证命令长度，防止过长的命令导致缓冲区溢出
    const maxCommandLength = 10000; // 10KB 命令长度限制
    if (command.length > maxCommandLength) {
      throw new Error(`Command exceeds maximum length of ${maxCommandLength} characters`);
    }

    // step3. 验证工作目录（如果指定）
    if (cwd) {
      this.validateWorkingDirectory(cwd);
    }

    // step4. 验证环境变量（如果提供）
    if (env) {
      this.validateEnvironmentVariables(env);
    }

    // Set timeout (use parameter or config max)
    const execTimeout = Math.min(
      timeout ?? this.config.maxTimeout,
      this.config.maxTimeout
    );

    const startTime = Date.now();

    try {
      // step1. 在 Windows 上处理编码问题
      let finalCommand = command;
      if (isWindows()) {
        // 在 Windows 上设置控制台编码为 UTF-8，然后执行命令
        finalCommand = `chcp 65001 >nul 2>&1 && ${command}`;
      }

      const { stdout, stderr } = await execAsync(finalCommand, {
        cwd,
        timeout: execTimeout,
        env: { ...process.env, ...env },
        maxBuffer: this.config.maxOutputSize,
        windowsHide: true,
        encoding: 'buffer',
      });

      const executionTime = Date.now() - startTime;

      return {
        stdout: this.truncateOutput(this.decodeOutput(stdout)),
        stderr: this.truncateOutput(this.decodeOutput(stderr)),
        exitCode: 0,
        timedOut: false,
        executionTime,
      };
    } catch (error: any) {
      const executionTime = Date.now() - startTime;

      // Handle timeout
      if (error.killed && error.signal === 'SIGTERM') {
        return {
          stdout: this.truncateOutput(this.decodeOutput(error.stdout)),
          stderr: `Command timed out after ${execTimeout}ms`,
          exitCode: -1,
          timedOut: true,
          executionTime,
        };
      }

      // Handle other errors
      return {
        stdout: this.truncateOutput(this.decodeOutput(error.stdout)),
        stderr: this.truncateOutput(this.decodeOutput(error.stderr) || error.message),
        exitCode: error.code || -1,
        timedOut: false,
        executionTime,
      };
    }
  }

  /**
   * Validate the command string
   * @param command - The command to validate
   * @throws Error if the command is invalid
   */
  private validateCommand(command: string): void {
    if (!command || typeof command !== 'string') {
      throw new Error('Command must be a non-empty string');
    }

    if (command.trim().length === 0) {
      throw new Error('Command cannot be empty');
    }

    // Check for shell metacharacters if not allowed
    if (!this.config.allowShellMetacharacters) {
      const metacharacters = ['|', '&', ';', '$', '`', '(', ')', '<', '>', '\n'];
      const hasMetacharacters = metacharacters.some(char => command.includes(char));
      if (hasMetacharacters) {
        throw new Error('Shell metacharacters are not allowed');
      }
    }
  }

  /**
   * Validate the working directory
   * @param cwd - The working directory to validate
   * @throws Error if the directory is not allowed
   */
  private validateWorkingDirectory(cwd: string): void {
    // step1. 验证工作目录路径长度
    if (cwd.length > 1000) {
      throw new Error('Working directory path exceeds maximum length');
    }

    // step2. 检查是否包含路径遍历攻击模式
    const pathTraversalPatterns = [
      /\.\.[\/\\]/,  // ../ 或 ..\
      /\.\.$/,       // 以 .. 结尾
    ];

    for (const pattern of pathTraversalPatterns) {
      if (pattern.test(cwd)) {
        throw new Error('Working directory contains path traversal sequences');
      }
    }

    // step3. 检查是否在允许的目录列表中
    if (this.config.allowedWorkingDirectories.length > 0) {
      const isAllowed = this.config.allowedWorkingDirectories.some(allowedDir =>
        cwd.startsWith(allowedDir)
      );
      if (!isAllowed) {
        throw new Error(`Working directory '${cwd}' is not in the allowed list`);
      }
    }
  }

  /**
   * Validate environment variables
   * @param env - Environment variables to validate
   * @throws Error if environment variables contain dangerous values
   */
  private validateEnvironmentVariables(env: Record<string, string>): void {
    // step1. 验证环境变量数量
    if (Object.keys(env).length > 100) {
      throw new Error('Too many environment variables (max: 100)');
    }

    // step2. 验证每个环境变量的键和值
    for (const [key, value] of Object.entries(env)) {
      // 验证键名
      if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(key)) {
        throw new Error(`Invalid environment variable name: ${key}`);
      }

      // 验证值长度
      if (value.length > 10000) {
        throw new Error(`Environment variable value for '${key}' exceeds maximum length`);
      }

      // 防止通过环境变量注入危险命令
      const dangerousPatterns = [
        /\$\(/,        // $(command) 替换
        /`/,           // 反引号命令替换
        /\|\s*\w/,     // 管道到命令
        /;\s*\w/,      // 命令分隔符
        /&&\s*\w/,     // 逻辑与执行
        /\|\|\s*\w/,   // 逻辑或执行
      ];

      for (const pattern of dangerousPatterns) {
        if (pattern.test(value)) {
          throw new Error(`Environment variable '${key}' contains potentially dangerous pattern`);
        }
      }
    }
  }

  /**
   * Truncate output if it exceeds maximum size
   * @param output - The output to truncate
   * @returns The truncated output
   */
  private truncateOutput(output: string): string {
    const maxLength = this.config.maxOutputSize;
    if (output.length > maxLength) {
      return output.substring(0, maxLength) + `\n[Output truncated at ${maxLength} bytes]`;
    }
    return output;
  }

  /**
   * Get the tool definition
   * @returns The tool definition
   */
  getDefinition() {
    return {
      name: 'terminal',
      description: 'Execute shell commands in the terminal',
      inputSchema: {
        type: 'object' as const,
        properties: {
          command: {
            type: 'string',
            description: 'The shell command to execute',
          },
          cwd: {
            type: 'string',
            description: 'Working directory for command execution',
          },
          timeout: {
            type: 'number',
            description: 'Timeout in milliseconds (default: 120000)',
          },
          env: {
            type: 'object',
            description: 'Environment variables for the command',
          },
        },
        required: ['command'],
      },
      requiresSecurityCheck: true,
    };
  }

  /**
   * Update the tool configuration
   * @param config - The new configuration
   */
  updateConfig(config: Partial<TerminalToolConfig>): void {
    this.config = {
      ...this.config,
      ...config,
    };
  }
}
