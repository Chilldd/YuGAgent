/**
 * Security Chain
 * Manages security rule validation for tool execution
 */

import type { SecurityRule, SecurityValidationResult, ToolExecuteRequest } from '../interface';

/**
 * Security Chain class for managing and validating security rules
 */
export class SecurityChain {
  private rules: Map<string, SecurityRule> = new Map();

  /**
   * Create a new security chain
   * @param initialRules - Optional initial set of rules
   */
  constructor(initialRules: SecurityRule[] = []) {
    initialRules.forEach(rule => this.addRule(rule));
  }

  /**
   * Add a security rule to the chain
   * @param rule - The security rule to add
   * @throws Error if a rule with the same ID already exists
   */
  addRule(rule: SecurityRule): void {
    if (this.rules.has(rule.id)) {
      throw new Error(`Security rule with ID '${rule.id}' already exists`);
    }
    this.rules.set(rule.id, rule);
  }

  /**
   * Remove a security rule from the chain
   * @param ruleId - ID of the rule to remove
   * @returns true if the rule was removed, false if not found
   */
  removeRule(ruleId: string): boolean {
    return this.rules.delete(ruleId);
  }

  /**
   * Enable a security rule
   * @param ruleId - ID of the rule to enable
   * @returns true if the rule was enabled, false if not found
   */
  enableRule(ruleId: string): boolean {
    const rule = this.rules.get(ruleId);
    if (rule) {
      rule.enabled = true;
      return true;
    }
    return false;
  }

  /**
   * Disable a security rule
   * @param ruleId - ID of the rule to disable
   * @returns true if the rule was disabled, false if not found
   */
  disableRule(ruleId: string): boolean {
    const rule = this.rules.get(ruleId);
    if (rule) {
      rule.enabled = false;
      return true;
    }
    return false;
  }

  /**
   * Check if a rule is enabled
   * @param ruleId - ID of the rule to check
   * @returns true if the rule exists and is enabled, false otherwise
   */
  isRuleEnabled(ruleId: string): boolean {
    const rule = this.rules.get(ruleId);
    return rule ? rule.enabled : false;
  }

  /**
   * Get all security rules
   * @returns Array of all security rules
   */
  getRules(): SecurityRule[] {
    return Array.from(this.rules.values());
  }

  /**
   * Get a specific rule by ID
   * @param ruleId - ID of the rule to get
   * @returns The rule or undefined if not found
   */
  getRule(ruleId: string): SecurityRule | undefined {
    return this.rules.get(ruleId);
  }

  /**
   * Get only enabled rules
   * @returns Array of enabled security rules
   */
  getEnabledRules(): SecurityRule[] {
    return Array.from(this.rules.values()).filter(rule => rule.enabled);
  }

  /**
   * Get rules by severity level
   * @param severity - The severity level to filter by
   * @returns Array of rules with the specified severity
   */
  getRulesBySeverity(severity: 'low' | 'medium' | 'high' | 'critical'): SecurityRule[] {
    return Array.from(this.rules.values()).filter(
      rule => rule.severity === severity && rule.enabled
    );
  }

  /**
   * Check a request against all enabled security rules
   * @param request - The tool execution request to validate
   * @returns The validation result
   */
  async check(request: ToolExecuteRequest): Promise<SecurityValidationResult> {
    const enabledRules = this.getEnabledRules();

    // Sort rules by severity (critical first)
    const sortedRules = enabledRules.sort((a, b) => {
      const severityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
      return severityOrder[a.severity] - severityOrder[b.severity];
    });

    // step1. 记录安全检查开始（在调试模式下）
    // step2. 生产环境应使用日志系统而非 console
    // Check each rule in order
    for (const rule of sortedRules) {
      try {
        const result = await rule.validate(request);
        if (!result.passed) {
          // 记录安全规则失败
          console.warn(`[SecurityChain] Rule '${rule.id}' (${rule.severity}) blocked request: ${result.error}`);
          return {
            passed: false,
            error: result.error || `Security rule '${rule.id}' validation failed`,
            rule,
          };
        }
      } catch (error) {
        // If a rule throws an error, consider it a failure
        const errorMessage = `Security rule '${rule.id}' threw an error: ${error instanceof Error ? error.message : String(error)}`;
        console.error(`[SecurityChain] ${errorMessage}`);
        return {
          passed: false,
          error: errorMessage,
          rule,
        };
      }
    }

    // All rules passed
    return { passed: true };
  }

  /**
   * Check a request against a specific rule
   * @param request - The tool execution request to validate
   * @param ruleId - ID of the specific rule to check
   * @returns The validation result
   */
  async checkRule(request: ToolExecuteRequest, ruleId: string): Promise<SecurityValidationResult> {
    const rule = this.rules.get(ruleId);
    if (!rule) {
      return {
        passed: false,
        error: `Security rule '${ruleId}' not found`,
      };
    }

    if (!rule.enabled) {
      return {
        passed: true, // Disabled rules pass automatically
      };
    }

    try {
      const result = await rule.validate(request);
      if (!result.passed) {
        return {
          passed: false,
          error: result.error || `Security rule '${ruleId}' validation failed`,
          rule,
        };
      }
      return { passed: true };
    } catch (error) {
      return {
        passed: false,
        error: `Security rule '${ruleId}' threw an error: ${error instanceof Error ? error.message : String(error)}`,
        rule,
      };
    }
  }

  /**
   * Clear all rules from the chain
   */
  clear(): void {
    this.rules.clear();
  }

  /**
   * Get the number of rules in the chain
   * @returns The number of rules
   */
  size(): number {
    return this.rules.size;
  }

  /**
   * Check if the chain has any rules
   * @returns true if the chain has rules, false otherwise
   */
  isEmpty(): boolean {
    return this.rules.size === 0;
  }

  /**
   * Clone the security chain
   * @returns A new SecurityChain with the same rules
   */
  clone(): SecurityChain {
    const cloned = new SecurityChain();
    this.rules.forEach(rule => {
      cloned.addRule({ ...rule });
    });
    return cloned;
  }
}
