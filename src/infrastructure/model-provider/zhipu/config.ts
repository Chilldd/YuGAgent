/**
 * @fileoverview Zhipu AI configuration management
 * @module infrastructure/model-provider/zhipu/config
 */

import type { ModelProviderConfig } from '../interface.js';

/**
 * Zhipu AI specific configuration
 */
export interface ZhipuConfig extends ModelProviderConfig {
  /** API key for Zhipu AI (overrides apiKey) */
  apiKey: string;
  /** Base URL for Zhipu API (defaults to https://open.bigmodel.cn/api/paas/v4) */
  baseURL?: string;
  /** Default model to use (defaults to glm-4.7) */
  model?: string;
  /** Request timeout in milliseconds (defaults to 60000) */
  timeout?: number;
  /** Maximum retries for failed requests (defaults to 3) */
  maxRetries?: number;
}

/**
 * Default configuration values for Zhipu AI
 */
const DEFAULT_ZHIPU_CONFIG: Partial<ZhipuConfig> = {
  baseURL: 'https://open.bigmodel.cn/api/paas/v4',
  model: 'glm-4.7',
  timeout: 60000,
  maxRetries: 3,
};

/**
 * Environment variable names for Zhipu AI configuration
 */
const ENV_VARS = {
  API_KEY: 'ZHIPU_API_KEY',
  BASE_URL: 'ZHIPU_BASE_URL',
  MODEL: 'ZHIPU_MODEL',
  TIMEOUT: 'ZHIPU_TIMEOUT',
  MAX_RETRIES: 'ZHIPU_MAX_RETRIES',
} as const;

/**
 * Get Zhipu AI configuration from environment variables
 * Reads configuration from process.env with fallback to defaults
 * @returns Zhipu AI configuration
 * @throws Error if API key is not found in environment
 */
export function getZhipuConfig(): ZhipuConfig {
  const apiKey = process.env[ENV_VARS.API_KEY];

  if (!apiKey) {
    throw new Error(
      `Zhipu AI API key not found. Please set the ${ENV_VARS.API_KEY} environment variable.`,
    );
  }

  const config: ZhipuConfig = {
    apiKey,
    baseURL: (process.env[ENV_VARS.BASE_URL] as string | undefined) ?? DEFAULT_ZHIPU_CONFIG.baseURL,
    model: (process.env[ENV_VARS.MODEL] as string | undefined) ?? DEFAULT_ZHIPU_CONFIG.model,
    timeout: process.env[ENV_VARS.TIMEOUT]
      ? Number.parseInt(process.env[ENV_VARS.TIMEOUT] as string, 10)
      : DEFAULT_ZHIPU_CONFIG.timeout,
    maxRetries: process.env[ENV_VARS.MAX_RETRIES]
      ? Number.parseInt(process.env[ENV_VARS.MAX_RETRIES] as string, 10)
      : DEFAULT_ZHIPU_CONFIG.maxRetries,
  };

  // Validate timeout value
  if (config.timeout !== undefined && (config.timeout <= 0 || !Number.isFinite(config.timeout))) {
    throw new Error(`Invalid ${ENV_VARS.TIMEOUT}: must be a positive number`);
  }

  // Validate maxRetries value
  if (config.maxRetries !== undefined && (config.maxRetries < 0 || !Number.isInteger(config.maxRetries))) {
    throw new Error(`Invalid ${ENV_VARS.MAX_RETRIES}: must be a non-negative integer`);
  }

  return config;
}

/**
 * Get Zhipu AI configuration with custom overrides
 * @param overrides - Custom configuration to override environment values
 * @returns Merged Zhipu AI configuration
 * @throws Error if API key is not found in environment or overrides
 */
export function getZhipuConfigWithOverrides(overrides: Partial<ZhipuConfig>): ZhipuConfig {
  const baseConfig = getZhipuConfig();

  return {
    ...baseConfig,
    ...overrides,
  };
}

/**
 * Validate Zhipu AI configuration
 * @param config - Configuration to validate
 * @returns True if valid
 * @throws Error if configuration is invalid
 */
export function validateZhipuConfig(config: ZhipuConfig): boolean {
  if (!config.apiKey || typeof config.apiKey !== 'string' || config.apiKey.trim().length === 0) {
    throw new Error('Zhipu AI API key must be a non-empty string');
  }

  if (config.baseURL && typeof config.baseURL !== 'string') {
    throw new Error('Zhipu AI base URL must be a string');
  }

  if (config.model && typeof config.model !== 'string') {
    throw new Error('Zhipu AI model must be a string');
  }

  if (config.timeout !== undefined && (typeof config.timeout !== 'number' || config.timeout <= 0)) {
    throw new Error('Zhipu AI timeout must be a positive number');
  }

  if (
    config.maxRetries !== undefined &&
    (typeof config.maxRetries !== 'number' || config.maxRetries < 0 || !Number.isInteger(config.maxRetries))
  ) {
    throw new Error('Zhipu AI max retries must be a non-negative integer');
  }

  return true;
}

/**
 * Create a Zhipu AI configuration object
 * @param apiKey - API key for Zhipu AI
 * @param options - Optional configuration options
 * @returns Zhipu AI configuration
 */
export function createZhipuConfig(
  apiKey: string,
  options?: Partial<Omit<ZhipuConfig, 'apiKey'>>,
): ZhipuConfig {
  const config: ZhipuConfig = {
    apiKey,
    baseURL: options?.baseURL ?? DEFAULT_ZHIPU_CONFIG.baseURL,
    model: options?.model ?? DEFAULT_ZHIPU_CONFIG.model,
    timeout: options?.timeout ?? DEFAULT_ZHIPU_CONFIG.timeout,
    maxRetries: options?.maxRetries ?? DEFAULT_ZHIPU_CONFIG.maxRetries,
  };

  validateZhipuConfig(config);

  return config;
}
