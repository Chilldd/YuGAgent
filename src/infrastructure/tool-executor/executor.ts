/**
 * Tool Executor
 * Main executor implementation with security chain and built-in tools
 */

import { randomUUID } from 'node:crypto';

import type {
  IToolExecutor,
  ToolExecutionDefinition,
  ToolExecuteRequest,
  ToolExecuteResponse,
  SecurityRule,
} from './interface.js';

import { SecurityChain, getAllBuiltInRules } from './security/index.js';
import { TerminalTool, FileReadTool, DirectoryListTool } from './tools/index.js';

/**
 * Tool executor configuration
 */
export interface ToolExecutorConfig {
  /** Whether to enable built-in security rules */
  enableBuiltInSecurity?: boolean;

  /** Additional security rules to add */
  additionalSecurityRules?: SecurityRule[];

  /** Maximum timeout for tool execution (ms) */
  maxTimeout?: number;

  /** Whether to log execution */
  enableLogging?: boolean;
}

/**
 * Tool handler function type
 */
type ToolHandler = (params: any, context?: any) => Promise<any>;

/**
 * ToolExecutor class - implements IToolExecutor interface
 */
export class ToolExecutor implements IToolExecutor {
  private securityChain: SecurityChain;
  private tools: Map<string, ToolExecutionDefinition>;
  private handlers: Map<string, ToolHandler>;
  private builtinTools: Map<string, ToolHandler>;
  private config: Required<ToolExecutorConfig>;

  constructor(config: ToolExecutorConfig = {}) {
    this.tools = new Map();
    this.handlers = new Map();
    this.builtinTools = new Map();
    this.config = {
      enableBuiltInSecurity: config.enableBuiltInSecurity ?? true,
      additionalSecurityRules: config.additionalSecurityRules ?? [],
      maxTimeout: config.maxTimeout ?? 120000,
      enableLogging: config.enableLogging ?? false,
    };

    // Initialize security chain
    this.securityChain = new SecurityChain();
    if (this.config.enableBuiltInSecurity) {
      getAllBuiltInRules().forEach(rule => this.securityChain.addRule(rule));
    }
    this.config.additionalSecurityRules.forEach(rule => this.securityChain.addRule(rule));

    // Initialize built-in tools
    this.initializeBuiltinTools();
  }

  /**
   * Initialize built-in tools
   */
  private initializeBuiltinTools(): void {
    // Terminal tool
    const terminalTool = new TerminalTool({
      maxTimeout: this.config.maxTimeout,
    });
    this.builtinTools.set('terminal', async (params, context) => {
      return terminalTool.execute({
        command: params.command,
        cwd: params.cwd || context?.workingDirectory,
        timeout: params.timeout,
        env: params.env,
      });
    });
    this.tools.set('terminal', terminalTool.getDefinition());

    // File read tool
    const fileReadTool = new FileReadTool();
    this.builtinTools.set('file-read', async (params) => {
      return fileReadTool.execute(params);
    });
    this.tools.set('file-read', fileReadTool.getDefinition());

    // Directory list tool
    const directoryListTool = new DirectoryListTool();
    this.builtinTools.set('directory-list', async (params) => {
      return directoryListTool.execute(params);
    });
    this.tools.set('directory-list', directoryListTool.getDefinition());
  }

  /**
   * Register a tool for execution
   * @param tool - The tool definition
   * @param handler - Function to handle tool execution
   */
  registerTool(tool: ToolExecutionDefinition, handler: ToolHandler): void {
    if (this.tools.has(tool.name)) {
      throw new Error(`Tool '${tool.name}' is already registered`);
    }
    this.tools.set(tool.name, tool);
    this.handlers.set(tool.name, handler);
  }

  /**
   * Unregister a tool
   * @param toolName - Name of the tool to unregister
   */
  unregisterTool(toolName: string): void {
    // Cannot unregister built-in tools
    if (this.builtinTools.has(toolName)) {
      throw new Error(`Cannot unregister built-in tool '${toolName}'`);
    }
    this.tools.delete(toolName);
    this.handlers.delete(toolName);
  }

  /**
   * Get all registered tools
   * @returns Map of tool name to tool definition
   */
  getTools(): Map<string, ToolExecutionDefinition> {
    return new Map(this.tools);
  }

  /**
   * Get a specific tool by name
   * @param toolName - Name of the tool
   * @returns The tool definition or undefined
   */
  getTool(toolName: string): ToolExecutionDefinition | undefined {
    return this.tools.get(toolName);
  }

  /**
   * Execute a tool
   * @param request - The execution request
   * @returns Promise resolving to execution response
   */
  async execute(request: ToolExecuteRequest): Promise<ToolExecuteResponse> {
    const requestId = randomUUID();
    const startTime = Date.now();

    // Check if tool exists
    const tool = this.tools.get(request.toolName);
    if (!tool) {
      return {
        result: {
          success: false,
          error: `Tool '${request.toolName}' not found`,
        },
        tool: {
          name: request.toolName,
          description: 'Unknown tool',
          inputSchema: { type: 'object', properties: {} },
          requiresSecurityCheck: false,
        },
        timestamp: new Date().toISOString(),
        requestId,
      };
    }

    // Validate parameters
    const validationError = this.validateParameters(tool, request.parameters);
    if (validationError) {
      return {
        result: {
          success: false,
          error: validationError,
        },
        tool,
        timestamp: new Date().toISOString(),
        requestId,
      };
    }

    // Security check
    if (tool.requiresSecurityCheck) {
      const securityResult = await this.securityChain.check(request);
      if (!securityResult.passed) {
        return {
          result: {
            success: false,
            error: securityResult.error || 'Security validation failed',
          },
          tool,
          timestamp: new Date().toISOString(),
          requestId,
        };
      }
    }

    // Get handler
    const handler = this.builtinTools.get(request.toolName) || this.handlers.get(request.toolName);
    if (!handler) {
      return {
        result: {
          success: false,
          error: `No handler found for tool '${request.toolName}'`,
        },
        tool,
        timestamp: new Date().toISOString(),
        requestId,
      };
    }

    // Execute tool
    try {
      const data = await handler(request.parameters, request.context);
      const executionTime = Date.now() - startTime;

      if (this.config.enableLogging) {
        console.log(`[ToolExecutor] Executed ${request.toolName} in ${executionTime}ms`);
      }

      return {
        result: {
          success: true,
          data,
          metadata: {
            executionTime,
          },
        },
        tool,
        timestamp: new Date().toISOString(),
        requestId,
      };
    } catch (error: any) {
      const executionTime = Date.now() - startTime;

      if (this.config.enableLogging) {
        console.error(`[ToolExecutor] Error executing ${request.toolName}:`, error.message);
      }

      return {
        result: {
          success: false,
          error: error.message || 'Unknown error occurred',
          metadata: {
            executionTime,
          },
        },
        tool,
        timestamp: new Date().toISOString(),
        requestId,
      };
    }
  }

  /**
   * Validate tool parameters against schema
   * @param tool - The tool definition
   * @param parameters - The parameters to validate
   * @returns Error message if validation fails, undefined otherwise
   */
  private validateParameters(tool: ToolExecutionDefinition, parameters: any): string | undefined {
    const schema = tool.inputSchema;
    const required = schema.required || [];

    // step1. 验证参数对象
    if (!parameters || typeof parameters !== 'object') {
      return 'Parameters must be a valid object';
    }

    // step2. 验证参数数量
    const paramCount = Object.keys(parameters).length;
    if (paramCount > 100) {
      return 'Too many parameters (max: 100)';
    }

    // step3. 检查必需参数
    for (const paramName of required) {
      if (!(paramName in parameters)) {
        return `Missing required parameter: ${paramName}`;
      }
    }

    // step4. 验证每个参数
    for (const [paramName, paramValue] of Object.entries(parameters)) {
      const paramSchema = schema.properties[paramName];
      if (!paramSchema) {
        return `Unknown parameter: ${paramName}`;
      }

      // 类型验证
      if (paramSchema.enum && !paramSchema.enum.includes(paramValue as never)) {
        return `Parameter '${paramName}' must be one of: ${(paramSchema.enum as string[]).join(', ')}`;
      }

      // step5. 验证字符串参数长度
      if (typeof paramValue === 'string') {
        const MAX_STRING_LENGTH = 10000;
        if (paramValue.length > MAX_STRING_LENGTH) {
          return `Parameter '${paramName}' exceeds maximum length of ${MAX_STRING_LENGTH}`;
        }
      }

      // step6. 验证数组参数大小
      if (Array.isArray(paramValue)) {
        const MAX_ARRAY_LENGTH = 1000;
        if (paramValue.length > MAX_ARRAY_LENGTH) {
          return `Parameter '${paramName}' array exceeds maximum length of ${MAX_ARRAY_LENGTH}`;
        }
      }
    }

    return undefined;
  }

  /**
   * Add a security rule
   * @param rule - The security rule to add
   */
  addSecurityRule(rule: SecurityRule): void {
    this.securityChain.addRule(rule);
  }

  /**
   * Remove a security rule
   * @param ruleId - ID of the rule to remove
   */
  removeSecurityRule(ruleId: string): void {
    this.securityChain.removeRule(ruleId);
  }

  /**
   * Get all security rules
   * @returns Array of security rules
   */
  getSecurityRules(): SecurityRule[] {
    return this.securityChain.getRules();
  }

  /**
   * Get the security chain
   * @returns The security chain instance
   */
  getSecurityChain(): SecurityChain {
    return this.securityChain;
  }

  /**
   * List all available tools
   * @returns Array of tool definitions
   */
  listTools(): ToolExecutionDefinition[] {
    return Array.from(this.tools.values());
  }

  /**
   * Get tool names by category
   * @returns Object with builtin and custom tool names
   */
  getToolNames(): { builtin: string[]; custom: string[] } {
    const builtin = Array.from(this.builtinTools.keys());
    const custom = Array.from(this.handlers.keys());
    return { builtin, custom };
  }
}
