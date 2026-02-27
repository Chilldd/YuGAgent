/**
 * @fileoverview Model Provider Registry for managing model providers
 * @module infrastructure/model-provider/registry
 */

import type { IModelProvider, ModelProviderConfig } from './interface.js';
import type { ZhipuConfig } from './zhipu/config.js';

/**
 * Provider type identifiers
 */
export enum ProviderType {
  /** Zhipu AI provider */
  ZHIPU = 'zhipu',
  /** OpenAI provider (future) */
  OPENAI = 'openai',
  /** Anthropic provider (future) */
  ANTHROPIC = 'anthropic',
  /** Local provider (future) */
  LOCAL = 'local',
}

/**
 * Provider registration entry
 */
interface ProviderRegistration {
  /** Provider instance */
  provider: IModelProvider;
  /** Provider type */
  type: ProviderType;
  /** Whether this is the default provider */
  isDefault: boolean;
  /** Registration timestamp */
  registeredAt: Date;
}

/**
 * Provider factory function type
 */
type ProviderFactory = (config: ModelProviderConfig) => IModelProvider;

/**
 * Model Provider Registry
 * Manages registration and retrieval of model providers
 */
export class ModelProviderRegistry {
  private readonly providers: Map<string, ProviderRegistration> = new Map();
  private readonly factories: Map<ProviderType, ProviderFactory> = new Map();
  private defaultProviderId: string | null = null;

  /**
   * Create a new ModelProviderRegistry instance
   */
  constructor() {
    // Register built-in factories
    this.registerBuiltInFactories();
  }

  /**
   * Register a model provider
   * @param providerId - Unique identifier for the provider
   * @param provider - Provider instance to register
   * @param type - Provider type
   * @param isDefault - Whether this should be the default provider
   */
  register(providerId: string, provider: IModelProvider, type: ProviderType, isDefault = false): void {
    if (this.providers.has(providerId)) {
      throw new Error(`Provider with ID '${providerId}' is already registered`);
    }

    this.providers.set(providerId, {
      provider,
      type,
      isDefault,
      registeredAt: new Date(),
    });

    // Set as default if requested
    if (isDefault) {
      this.defaultProviderId = providerId;
    }

    // If this is the first provider and no default is set, make it default
    if (this.providers.size === 1 && this.defaultProviderId === null) {
      this.defaultProviderId = providerId;
      const entry = this.providers.get(providerId);
      if (entry) {
        entry.isDefault = true;
      }
    }
  }

  /**
   * Unregister a model provider
   * @param providerId - ID of the provider to unregister
   * @returns True if provider was unregistered, false if not found
   */
  unregister(providerId: string): boolean {
    const entry = this.providers.get(providerId);
    if (!entry) {
      return false;
    }

    // If this was the default provider, clear the default
    if (this.defaultProviderId === providerId) {
      this.defaultProviderId = null;
      entry.isDefault = false;

      // Try to set a new default from remaining providers
      for (const [id, providerEntry] of this.providers.entries()) {
        if (id !== providerId) {
          this.defaultProviderId = id;
          providerEntry.isDefault = true;
          break;
        }
      }
    }

    return this.providers.delete(providerId);
  }

  /**
   * Get a registered provider by ID
   * @param providerId - ID of the provider to get
   * @returns Provider instance or undefined if not found
   */
  get(providerId: string): IModelProvider | undefined {
    const entry = this.providers.get(providerId);
    return entry?.provider;
  }

  /**
   * Get the default provider
   * @returns Default provider instance or undefined if no default is set
   */
  getDefault(): IModelProvider | undefined {
    if (this.defaultProviderId === null) {
      return undefined;
    }
    return this.get(this.defaultProviderId);
  }

  /**
   * Get a provider by type
   * @param type - Provider type to get
   * @returns First provider of the specified type or undefined if not found
   */
  getByType(type: ProviderType): IModelProvider | undefined {
    for (const entry of this.providers.values()) {
      if (entry.type === type) {
        return entry.provider;
      }
    }
    return undefined;
  }

  /**
   * Set the default provider
   * @param providerId - ID of the provider to set as default
   * @returns True if default was set, false if provider not found
   */
  setDefault(providerId: string): boolean {
    const entry = this.providers.get(providerId);
    if (!entry) {
      return false;
    }

    // Unset current default
    if (this.defaultProviderId !== null) {
      const currentDefault = this.providers.get(this.defaultProviderId);
      if (currentDefault) {
        currentDefault.isDefault = false;
      }
    }

    // Set new default
    this.defaultProviderId = providerId;
    entry.isDefault = true;

    return true;
  }

  /**
   * Get all registered provider IDs
   * @returns Array of registered provider IDs
   */
  getProviderIds(): string[] {
    return Array.from(this.providers.keys());
  }

  /**
   * Get all registered providers
   * @returns Map of provider ID to provider instance
   */
  getAllProviders(): Map<string, IModelProvider> {
    const result = new Map<string, IModelProvider>();
    for (const [id, entry] of this.providers.entries()) {
      result.set(id, entry.provider);
    }
    return result;
  }

  /**
   * Check if a provider is registered
   * @param providerId - ID of the provider to check
   * @returns True if provider is registered
   */
  has(providerId: string): boolean {
    return this.providers.has(providerId);
  }

  /**
   * Get the number of registered providers
   * @returns Number of registered providers
   */
  get size(): number {
    return this.providers.size;
  }

  /**
   * Clear all registered providers
   */
  clear(): void {
    this.providers.clear();
    this.defaultProviderId = null;
  }

  /**
   * Register a provider factory for dynamic provider creation
   * @param type - Provider type
   * @param factory - Factory function to create provider instances
   */
  registerFactory(type: ProviderType, factory: ProviderFactory): void {
    this.factories.set(type, factory);
  }

  /**
   * Create a provider using a registered factory
   * @param type - Provider type
   * @param config - Provider configuration
   * @param providerId - ID to register the created provider with
   * @param isDefault - Whether the created provider should be the default
   * @returns Created provider instance
   * @throws Error if factory is not registered for the type
   */
  createAndRegister(
    type: ProviderType,
    config: ModelProviderConfig,
    providerId: string,
    isDefault = false,
  ): IModelProvider {
    const factory = this.factories.get(type);
    if (!factory) {
      throw new Error(`No factory registered for provider type '${type}'`);
    }

    const provider = factory(config);
    this.register(providerId, provider, type, isDefault);

    return provider;
  }

  /**
   * Register built-in provider factories
   * @private
   */
  private registerBuiltInFactories(): void {
    // Zhipu factory - imported dynamically to avoid circular dependency
    this.registerFactory(ProviderType.ZHIPU, (config: ModelProviderConfig) => {
      // Dynamic import to avoid circular dependency
      // eslint-disable-next-line @typescript-eslint/no-unsafe-return
      return import('./zhipu/adapter.js').then(({ ZhipuModelProvider }) => {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-return
        return new ZhipuModelProvider(config as ZhipuConfig);
      }) as unknown as IModelProvider;
    });

    // Additional factories will be registered here as new providers are implemented
    // - OpenAI factory
    // - Anthropic factory
    // - Local factory (Ollama, etc.)
  }
}

/**
 * Global model provider registry instance
 */
export const modelProviderRegistry = new ModelProviderRegistry();
