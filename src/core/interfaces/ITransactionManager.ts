import type { Task } from '../../types/task.d.ts';

/**
 * Type for transaction changes
 */
export type TransactionChange = {
  type: string;
  task: Task;
  metadata?: unknown;
};

/**
 * Interface for transaction management operations
 */
export interface ITransactionManager {
  /**
   * Begin a transaction
   * @throws Error if a transaction is already in progress
   */
  beginTransaction(): void;

  /**
   * Commit a transaction
   * @returns Array of changes made during the transaction
   * @throws Error if no transaction is in progress
   */
  commitTransaction(): TransactionChange[];

  /**
   * Roll back a transaction
   * @throws Error if no transaction is in progress
   */
  rollbackTransaction(): void;

  /**
   * Record a change in the transaction
   * @param type Type of change
   * @param task Task that was changed
   * @param metadata Additional metadata about the change
   */
  recordChange(type: string, task: Task, metadata?: unknown): void;

  /**
   * Check if a transaction is in progress
   * @returns True if a transaction is in progress, false otherwise
   */
  isTransactionInProgress(): boolean;
}
