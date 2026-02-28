/**
 * Tool Executor Interface
 * Defines the contract for tool execution with security controls
 */

/**
 * Tool execution definition metadata
 */
export interface ToolExecutionDefinition {
  /** Unique identifier for the tool */
  name: string;

  /** Human-readable description */
  description: string;

  /** JSON Schema for input parameters */
  inputSchema: {
    type: 'object';
    properties: Record<string, {
      type: string;
      description?: string;
      enum?: string[];
      default?: any;
      required?: boolean;
    }>;
    required?: string[];
  };

  /** Whether this tool requires security validation */
  requiresSecurityCheck: boolean;
}

/**
 * Request to execute a tool
 */
export interface ToolExecuteRequest {
  /** Name of the tool to execute */
  toolName: string;

  /** Parameters to pass to the tool */
  parameters: Record<string, any>;

  /** Optional execution context */
  context?: {
    workingDirectory?: string;
    userId?: string;
    sessionId?: string;
    timeout?: number;
  };
}

/**
 * Result of a tool execution
 */
export interface ToolExecuteResult {
  /** Whether the execution was successful */
  success: boolean;

  /** The result data if successful */
  data?: any;

  /** Error message if failed */
  error?: string;

  /** Additional metadata */
  metadata?: {
    executionTime?: number;
    outputSize?: number;
    exitCode?: number;
  };
}

/**
 * Response from tool execution
 */
export interface ToolExecuteResponse {
  /** The result of the execution */
  result: ToolExecuteResult;

  /** The tool that was executed */
  tool: ToolExecutionDefinition;

  /** Timestamp of execution */
  timestamp: string;

  /** Request ID for tracing */
  requestId: string;
}

/**
 * Security rule definition
 */
export interface SecurityRule {
  /** Unique identifier for the rule */
  id: string;

  /** Human-readable description */
  description: string;

  /** Severity level */
  severity: 'low' | 'medium' | 'high' | 'critical';

  /** Whether this rule is enabled */
  enabled: boolean;

  /** The validation function */
  validate: (request: ToolExecuteRequest) => SecurityValidationResult;
}

/**
 * Result of security validation
 */
export interface SecurityValidationResult {
  /** Whether validation passed */
  passed: boolean;

  /** Error message if validation failed */
  error?: string;

  /** The rule that triggered the failure */
  rule?: SecurityRule;
}

/**
 * Tool Executor Interface
 */
export interface IToolExecutor {
  /**
   * Register a tool for execution
   * @param tool - The tool definition
   * @param handler - Function to handle tool execution
   */
  registerTool(tool: ToolExecutionDefinition, handler: (params: any, context?: any) => Promise<any>): void;

  /**
   * Unregister a tool
   * @param toolName - Name of the tool to unregister
   */
  unregisterTool(toolName: string): void;

  /**
   * Get all registered tools
   * @returns Map of tool name to tool definition
   */
  getTools(): Map<string, ToolExecutionDefinition>;

  /**
   * Get a specific tool by name
   * @param toolName - Name of the tool
   * @returns The tool definition or undefined
   */
  getTool(toolName: string): ToolExecutionDefinition | undefined;

  /**
   * Execute a tool
   * @param request - The execution request
   * @returns Promise resolving to execution response
   */
  execute(request: ToolExecuteRequest): Promise<ToolExecuteResponse>;

  /**
   * Add a security rule
   * @param rule - The security rule to add
   */
  addSecurityRule(rule: SecurityRule): void;

  /**
   * Remove a security rule
   * @param ruleId - ID of the rule to remove
   */
  removeSecurityRule(ruleId: string): void;

  /**
   * Get all security rules
   * @returns Array of security rules
   */
  getSecurityRules(): SecurityRule[];

  /**
   * Get the security chain
   * @returns The security chain instance
   */
  getSecurityChain(): import('./security/index.js').SecurityChain;

  /**
   * List all available tools
   * @returns Array of tool definitions
   */
  listTools(): ToolExecutionDefinition[];

  /**
   * Get tool names by category
   * @returns Object with builtin and custom tool names
   */
  getToolNames(): { builtin: string[]; custom: string[] };
}
