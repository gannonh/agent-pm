import { describe, it, expect, beforeEach } from 'vitest';
import { TransactionManager } from '../TransactionManager.js';
import { FileSystemError, ErrorCode } from '../../../types/errors.js';

describe('TransactionManager', () => {
  let transactionManager: TransactionManager;

  beforeEach(() => {
    transactionManager = new TransactionManager();
  });

  describe('beginTransaction', () => {
    it('should begin a transaction', () => {
      transactionManager.beginTransaction();
      expect(transactionManager.isTransactionInProgress()).toBe(true);
    });

    it('should throw an error if a transaction is already in progress', () => {
      transactionManager.beginTransaction();
      expect(() => transactionManager.beginTransaction()).toThrow(
        new FileSystemError('Transaction already in progress', ErrorCode.TRANSACTION_IN_PROGRESS)
      );
    });
  });

  describe('commitTransaction', () => {
    it('should commit a transaction and return changes', () => {
      // Begin a transaction
      transactionManager.beginTransaction();

      // Record some changes
      const task1 = {
        id: '1',
        title: 'Task 1',
        description: 'Task 1',
        status: 'pending' as const,
        priority: 'medium' as const,
        dependencies: [],
      };
      const task2 = {
        id: '2',
        title: 'Task 2',
        description: 'Task 2',
        status: 'pending' as const,
        priority: 'medium' as const,
        dependencies: [],
      };

      transactionManager.recordChange('create', task1);
      transactionManager.recordChange('update', task2, {
        oldStatus: 'pending',
        newStatus: 'in-progress',
      });

      // Commit the transaction
      const changes = transactionManager.commitTransaction();

      // Verify that the transaction is no longer in progress
      expect(transactionManager.isTransactionInProgress()).toBe(false);

      // Verify that the changes were returned
      expect(changes).toHaveLength(2);
      expect(changes[0]).toEqual({ type: 'create', task: task1 });
      expect(changes[1]).toEqual({
        type: 'update',
        task: task2,
        metadata: { oldStatus: 'pending', newStatus: 'in-progress' },
      });
    });

    it('should throw an error if no transaction is in progress', () => {
      expect(() => transactionManager.commitTransaction()).toThrow(
        new FileSystemError('No transaction in progress', ErrorCode.NO_TRANSACTION)
      );
    });
  });

  describe('rollbackTransaction', () => {
    it('should roll back a transaction', () => {
      // Begin a transaction
      transactionManager.beginTransaction();

      // Record some changes
      const task = {
        id: '1',
        title: 'Task 1',
        description: 'Task 1',
        status: 'pending' as const,
        priority: 'medium' as const,
        dependencies: [],
      };
      transactionManager.recordChange('create', task);

      // Roll back the transaction
      transactionManager.rollbackTransaction();

      // Verify that the transaction is no longer in progress
      expect(transactionManager.isTransactionInProgress()).toBe(false);

      // Verify that the changes were discarded by starting a new transaction and committing it
      transactionManager.beginTransaction();
      const changes = transactionManager.commitTransaction();
      expect(changes).toHaveLength(0);
    });

    it('should throw an error if no transaction is in progress', () => {
      expect(() => transactionManager.rollbackTransaction()).toThrow(
        new FileSystemError('No transaction in progress', ErrorCode.NO_TRANSACTION)
      );
    });
  });

  describe('recordChange', () => {
    it('should record a change if a transaction is in progress', () => {
      // Begin a transaction
      transactionManager.beginTransaction();

      // Record a change
      const task = {
        id: '1',
        title: 'Task 1',
        description: 'Task 1',
        status: 'pending' as const,
        priority: 'medium' as const,
        dependencies: [],
      };
      transactionManager.recordChange('create', task);

      // Commit the transaction and verify the change was recorded
      const changes = transactionManager.commitTransaction();
      expect(changes).toHaveLength(1);
      expect(changes[0]).toEqual({ type: 'create', task });
    });

    it('should not record a change if no transaction is in progress', () => {
      // Record a change without beginning a transaction
      const task = {
        id: '1',
        title: 'Task 1',
        description: 'Task 1',
        status: 'pending' as const,
        priority: 'medium' as const,
        dependencies: [],
      };
      transactionManager.recordChange('create', task);

      // Begin a transaction and commit it to verify no changes were recorded
      transactionManager.beginTransaction();
      const changes = transactionManager.commitTransaction();
      expect(changes).toHaveLength(0);
    });
  });

  describe('isTransactionInProgress', () => {
    it('should return true if a transaction is in progress', () => {
      transactionManager.beginTransaction();
      expect(transactionManager.isTransactionInProgress()).toBe(true);
    });

    it('should return false if no transaction is in progress', () => {
      expect(transactionManager.isTransactionInProgress()).toBe(false);
    });

    it('should return false after a transaction is committed', () => {
      transactionManager.beginTransaction();
      transactionManager.commitTransaction();
      expect(transactionManager.isTransactionInProgress()).toBe(false);
    });

    it('should return false after a transaction is rolled back', () => {
      transactionManager.beginTransaction();
      transactionManager.rollbackTransaction();
      expect(transactionManager.isTransactionInProgress()).toBe(false);
    });
  });
});
