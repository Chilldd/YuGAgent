/**
 * @fileoverview In-memory session store for key-value storage
 * @module domain/memory/session-store
 */

/**
 * Generic in-memory key-value store
 * Provides basic CRUD operations for session data
 */
export class SessionStore<K = string, V = unknown> {
  private readonly store: Map<K, V>;

  constructor() {
    this.store = new Map<K, V>();
  }

  /**
   * Set a value in the store
   * @param key - The key to set
   * @param value - The value to store
   */
  set(key: K, value: V): void {
    this.store.set(key, value);
  }

  /**
   * Get a value from the store
   * @param key - The key to retrieve
   * @returns The stored value or undefined if not found
   */
  get(key: K): V | undefined {
    return this.store.get(key);
  }

  /**
   * Check if a key exists in the store
   * @param key - The key to check
   * @returns True if the key exists, false otherwise
   */
  has(key: K): boolean {
    return this.store.has(key);
  }

  /**
   * Delete a value from the store
   * @param key - The key to delete
   * @returns True if deleted, false if key didn't exist
   */
  delete(key: K): boolean {
    return this.store.delete(key);
  }

  /**
   * Clear all values from the store
   */
  clear(): void {
    this.store.clear();
  }

  /**
   * Get the number of entries in the store
   * @returns The size of the store
   */
  size(): number {
    return this.store.size;
  }

  /**
   * Get all keys in the store
   * @returns Array of all keys
   */
  keys(): K[] {
    return Array.from(this.store.keys());
  }

  /**
   * Get all values in the store
   * @returns Array of all values
   */
  values(): V[] {
    return Array.from(this.store.values());
  }

  /**
   * Get all entries in the store
   * @returns Array of [key, value] tuples
   */
  entries(): [K, V][] {
    return Array.from(this.store.entries());
  }

  /**
   * Iterate over each entry in the store
   * @param callback - Function to call for each entry
   */
  forEach(callback: (value: V, key: K, map: Map<K, V>) => void): void {
    this.store.forEach(callback);
  }

  /**
   * Update a value if it exists, otherwise set it
   * @param key - The key to update
   * @param updater - Function that receives the current value and returns the new value
   */
  update(key: K, updater: (currentValue: V | undefined) => V): void {
    const currentValue = this.store.get(key);
    const newValue = updater(currentValue);
    this.store.set(key, newValue);
  }

  /**
   * Get or create a value
   * @param key - The key to get or create
   * @param factory - Function to create the value if it doesn't exist
   * @returns The existing or newly created value
   */
  getOrCreate(key: K, factory: () => V): V {
    if (!this.store.has(key)) {
      this.store.set(key, factory());
    }
    return this.store.get(key)!;
  }

  /**
   * Get multiple values by keys
   * @param keys - Array of keys to retrieve
   * @returns Array of values (undefined for missing keys)
   */
  getMany(keys: K[]): (V | undefined)[] {
    return keys.map(key => this.store.get(key));
  }

  /**
   * Set multiple values at once
   * @param entries - Array of [key, value] tuples to set
   */
  setMany(entries: [K, V][]): void {
    for (const [key, value] of entries) {
      this.store.set(key, value);
    }
  }

  /**
   * Delete multiple keys at once
   * @param keys - Array of keys to delete
   * @returns Number of keys deleted
   */
  deleteMany(keys: K[]): number {
    let count = 0;
    for (const key of keys) {
      if (this.store.delete(key)) {
        count++;
      }
    }
    return count;
  }
}
