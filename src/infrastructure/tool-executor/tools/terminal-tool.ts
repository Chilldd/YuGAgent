/**
 * Terminal Tool
 * Executes shell commands using child_process.exec
 */

import { exec } from 'node:child_process';
import { promisify } from 'node:util';

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

    // Validate command
    this.validateCommand(command);

    // Validate working directory if specified
    if (cwd) {
      this.validateWorkingDirectory(cwd);
    }

    // Set timeout (use parameter or config max)
    const execTimeout = Math.min(
      timeout ?? this.config.maxTimeout,
      this.config.maxTimeout
    );

    const startTime = Date.now();

    try {
      const { stdout, stderr } = await execAsync(command, {
        cwd,
        timeout: execTimeout,
        env: { ...process.env, ...env },
        maxBuffer: this.config.maxOutputSize,
        windowsHide: true,
      });

      const executionTime = Date.now() - startTime;

      return {
        stdout: this.truncateOutput(stdout),
        stderr: this.truncateOutput(stderr),
        exitCode: 0,
        timedOut: false,
        executionTime,
      };
    } catch (error: any) {
      const executionTime = Date.now() - startTime;

      // Handle timeout
      if (error.killed && error.signal === 'SIGTERM') {
        return {
          stdout: error.stdout ? this.truncateOutput(error.stdout) : '',
          stderr: `Command timed out after ${execTimeout}ms`,
          exitCode: -1,
          timedOut: true,
          executionTime,
        };
      }

      // Handle other errors
      return {
        stdout: error.stdout ? this.truncateOutput(error.stdout) : '',
        stderr: error.stderr ? this.truncateOutput(error.stderr) : error.message,
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
