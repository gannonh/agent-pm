import type { Task } from '../../types/task.d.ts';
import type { ITransactionManager, TransactionChange } from '../interfaces/ITransactionManager.js';
import { FileSystemError, ErrorCode } from '../../types/errors.js';

/**
 * Implementation of the transaction manager
 */
export class TransactionManager implements ITransactionManager {
  private transactionInProgress: boolean = false;
  private transactionChanges: TransactionChange[] = [];

  /**
   * Begin a transaction
   * @throws Error if a transaction is already in progress
   */
  beginTransaction(): void {
    if (this.transactionInProgress) {
      throw new FileSystemError(
        'Transaction already in progress',
        ErrorCode.TRANSACTION_IN_PROGRESS
      );
    }
    this.transactionInProgress = true;
    this.transactionChanges = [];
  }

  /**
   * Commit a transaction
   * @returns Array of changes made during the transaction
   * @throws Error if no transaction is in progress
   */
  commitTransaction(): TransactionChange[] {
    if (!this.transactionInProgress) {
      throw new FileSystemError('No transaction in progress', ErrorCode.NO_TRANSACTION);
    }
    const changes = [...this.transactionChanges];
    this.transactionInProgress = false;
    this.transactionChanges = [];
    return changes;
  }

  /**
   * Roll back a transaction
   * @throws Error if no transaction is in progress
   */
  rollbackTransaction(): void {
    if (!this.transactionInProgress) {
      throw new FileSystemError('No transaction in progress', ErrorCode.NO_TRANSACTION);
    }
    this.transactionInProgress = false;
    this.transactionChanges = [];
  }

  /**
   * Record a change in the transaction
   * @param type Type of change
   * @param task Task that was changed
   * @param metadata Additional metadata about the change
   */
  recordChange(type: string, task: Task, metadata?: unknown): void {
    if (this.transactionInProgress) {
      this.transactionChanges.push({ type, task, metadata });
    }
  }

  /**
   * Check if a transaction is in progress
   * @returns True if a transaction is in progress, false otherwise
   */
  isTransactionInProgress(): boolean {
    return this.transactionInProgress;
  }
}
