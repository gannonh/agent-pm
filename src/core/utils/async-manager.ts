/**
 * @fileoverview Manages asynchronous operations with progress tracking, status monitoring, and error handling.
 * Provides a centralized way to handle long-running operations in a non-blocking manner.
 * @module async-manager
 */

import { v4 as uuidv4 } from 'uuid';

/**
 * Interface for logging operations at different severity levels.
 * @interface Logger
 */
export interface Logger {
  debug(message: string, meta?: Record<string, unknown>): void;
  info(message: string, meta?: Record<string, unknown>): void;
  warn(message: string, meta?: Record<string, unknown>): void;
  error(message: string, meta?: Record<string, unknown>): void;
  [key: string]: unknown;
}

/**
 * Represents the current state of an operation.
 * @typedef {'pending' | 'running' | 'completed' | 'failed' | 'cancelled' | 'not_found'} OperationStatus
 */
export type OperationStatus =
  | 'pending'
  | 'running'
  | 'completed'
  | 'failed'
  | 'cancelled'
  | 'not_found';

/**
 * Represents the result of an operation, including its status, timing, and outcome.
 * @template T The type of the operation's result data
 * @interface OperationResult
 */
export type OperationResult<T = unknown> = {
  id: string;
  status: OperationStatus;
  startTime: number;
  endTime: number | null;
  result: T | null;
  error: { code: string; message: string } | null;
};

/**
 * Represents the progress of an ongoing operation.
 * @interface OperationProgress
 */
export type OperationProgress = {
  /** Progress percentage (0-100) */
  progress: number;
  /** Optional total units to process */
  total?: number;
  /** Optional message describing the current progress state */
  message?: string;
  /** Optional timestamp when this progress update was reported */
  timestamp?: number;
  /** Optional estimated time remaining in seconds */
  estimatedTimeRemaining?: number;
  /** Optional estimated completion time (timestamp) */
  estimatedEndTime?: number;
  /** Optional current step in a multi-step operation */
  currentStep?: string;
  /** Optional total number of steps in the operation */
  totalSteps?: number;
  /** Optional current step number (1-based) */
  currentStepNumber?: number;
  /** Optional array of steps in the operation */
  steps?: string[];
};

/**
 * Context object provided to operations for logging and progress reporting.
 * @interface OperationContext
 */
export type OperationContext = {
  log: Logger;
  reportProgress?: (progress: OperationProgress) => void;
  session?: unknown;
};

/**
 * Function signature for operation implementations.
 * @template T The type of the operation's result data
 * @template A The type of the operation's arguments
 * @callback OperationFunction
 * @param {A} args - Arguments passed to the operation
 * @param {Logger} log - Logger instance for the operation
 * @param {Object} context - Operation context with progress reporting and session info
 * @returns {Promise<{success: boolean, data?: T, error?: {code: string, message: string}}>}
 */
export type OperationFunction<T = unknown, A = unknown> = (
  args: A,
  log: Logger,
  context: {
    reportProgress?: (progress: OperationProgress) => void;
    mcpLog?: Logger;
    session?: unknown;
  }
) => Promise<{
  success: boolean;
  data?: T;
  error?: { code: string; message: string };
}>;

/**
 * Manages asynchronous operations with progress tracking and status monitoring.
 * Provides functionality to add, execute, and monitor long-running operations.
 * @class AsyncOperationManager
 */
export class AsyncOperationManager {
  private operations = new Map<
    string,
    {
      id: string;
      status: OperationStatus;
      startTime: number;
      endTime: number | null;
      result: unknown | null;
      error: { code: string; message: string } | null;
      log: Logger;
      reportProgress?: (progress: OperationProgress) => void;
      session?: unknown;
    }
  >();

  private completedOperations = new Map<string, OperationResult>();
  private maxCompletedOperations = 100;
  private listeners = new Map<string, Array<(data: unknown) => void>>();

  /**
   * Adds a new operation to be executed asynchronously.
   * @template T The type of the operation's result data
   * @template A The type of the operation's arguments
   * @param {OperationFunction<T, A>} operationFn - The async function to execute
   * @param {A} args - Arguments to pass to the operation function
   * @param {OperationContext} context - Context containing logging and progress reporting functions
   * @returns {string} A unique ID assigned to this operation
   */
  addOperation<T = unknown, A = unknown>(
    operationFn: OperationFunction<T, A>,
    args: A,
    context: OperationContext
  ): string {
    const operationId = `op-${uuidv4()}`;
    const operation = {
      id: operationId,
      status: 'pending' as OperationStatus,
      startTime: Date.now(),
      endTime: null,
      result: null,
      error: null,
      log: context.log,
      reportProgress: context.reportProgress,
      session: context.session,
    };

    this.operations.set(operationId, operation);
    this.log(operationId, 'info', `Operation added.`);

    // Start execution in the background
    this._runOperation(operationId, operationFn, args).catch((err: Error) => {
      this.log(operationId, 'error', `Critical error starting operation: ${err.message}`, {
        stack: err.stack,
      });

      const op = this.operations.get(operationId);
      if (op) {
        op.status = 'failed';
        op.error = {
          code: 'MANAGER_EXECUTION_ERROR',
          message: err.message,
        };
        op.endTime = Date.now();

        this._moveToCompleted(operationId);
      }
    });

    return operationId;
  }

  /**
   * Internal method to execute an operation.
   * @template T The type of the operation's result data
   * @template A The type of the operation's arguments
   * @private
   * @param {string} operationId - The ID of the operation
   * @param {OperationFunction<T, A>} operationFn - The async function to execute
   * @param {A} args - Arguments for the function
   * @param {OperationContext} context - The original MCP tool context
   * @returns {Promise<void>}
   */
  private async _runOperation<T = unknown, A = unknown>(
    operationId: string,
    operationFn: OperationFunction<T, A>,
    args: A
  ): Promise<void> {
    const operation = this.operations.get(operationId);
    if (!operation) return;

    operation.status = 'running';
    this.log(operationId, 'info', `Operation running.`);
    this.emit('statusChanged', { operationId, status: 'running' });

    try {
      const result = await operationFn(args, operation.log, {
        reportProgress: (progress) => this._handleProgress(operationId, progress),
        mcpLog: operation.log,
        session: operation.session,
      });

      operation.status = result.success ? 'completed' : 'failed';
      operation.result = result.success ? result.data : null;
      operation.error = result.success
        ? null
        : (result.error ?? {
            code: 'UNKNOWN_ERROR',
            message: 'Operation failed without an error message',
          });

      this.log(operationId, 'info', `Operation finished with status: ${operation.status}`);
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      const errorStack = error instanceof Error ? error.stack : undefined;

      this.log(operationId, 'error', `Operation failed with error: ${errorMessage}`, {
        stack: errorStack,
      });

      operation.status = 'failed';
      operation.error = {
        code: 'OPERATION_EXECUTION_ERROR',
        message: errorMessage,
      };
    } finally {
      operation.endTime = Date.now();
      this.emit('statusChanged', {
        operationId,
        status: operation.status,
        result: operation.result,
        error: operation.error,
      });

      if (operation.status === 'completed' || operation.status === 'failed') {
        this._moveToCompleted(operationId);
      }
    }
  }

  /**
   * Moves an operation from active to completed operations history.
   * Manages the history size by removing oldest entries when exceeding the maximum limit.
   * @private
   * @param {string} operationId - The ID of the operation to move
   */
  private _moveToCompleted(operationId: string): void {
    const operation = this.operations.get(operationId);
    if (!operation) return;

    const completedData: OperationResult = {
      id: operation.id,
      status: operation.status,
      startTime: operation.startTime,
      endTime: operation.endTime,
      result: operation.result,
      error: operation.error,
    };

    this.completedOperations.set(operationId, completedData);
    this.operations.delete(operationId);

    // Trim completed operations if exceeding maximum
    if (this.completedOperations.size > this.maxCompletedOperations) {
      // Get the oldest operation (sorted by endTime)
      const oldest = [...this.completedOperations.entries()].sort(
        (a, b) => (a[1].endTime || 0) - (b[1].endTime || 0)
      )[0];

      if (oldest) {
        this.completedOperations.delete(oldest[0]);
      }
    }
  }

  /**
   * Handles progress updates from running operations and forwards them to registered handlers.
   * @private
   * @param {string} operationId - The ID of the operation reporting progress
   * @param {OperationProgress} progress - The progress object containing completion status
   */
  private _handleProgress(operationId: string, progress: OperationProgress): void {
    const operation = this.operations.get(operationId);
    if (operation && operation.reportProgress) {
      try {
        operation.reportProgress(progress);
        this.log(operationId, 'debug', `Reported progress: ${progress.progress}%`, {
          progress: {
            percentage: progress.progress,
            message: progress.message,
          },
        });
      } catch (err: unknown) {
        const errorMessage = err instanceof Error ? err.message : 'Unknown error';

        this.log(operationId, 'warn', `Failed to report progress: ${errorMessage}`);
      }
    }
  }

  /**
   * Retrieves the current status and result/error of an operation.
   * @param {string} operationId - The ID of the operation
   * @returns {OperationResult | {error: {code: string, message: string}, status: OperationStatus}}
   * The operation details or error status if not found
   */
  getStatus(
    operationId: string
  ): OperationResult | { error: { code: string; message: string }; status: OperationStatus } {
    // First check active operations
    const operation = this.operations.get(operationId);
    if (operation) {
      return {
        id: operation.id,
        status: operation.status,
        startTime: operation.startTime,
        endTime: operation.endTime,
        result: operation.result,
        error: operation.error,
      };
    }

    // Then check completed operations
    const completedOperation = this.completedOperations.get(operationId);
    if (completedOperation) {
      return completedOperation;
    }

    // Operation not found in either active or completed
    return {
      error: {
        code: 'OPERATION_NOT_FOUND',
        message: `Operation ID ${operationId} not found. It may have been completed and removed from history, or the ID may be invalid.`,
      },
      status: 'not_found',
    };
  }

  /**
   * Internal logging helper that prefixes logs with the operation ID.
   * @private
   * @param {string} operationId - The ID of the operation
   * @param {'info' | 'warn' | 'error' | 'debug'} level - Log level
   * @param {string} message - Log message
   * @param {Record<string, unknown>} [meta={}] - Additional metadata
   */
  private log(
    operationId: string,
    level: 'info' | 'warn' | 'error' | 'debug',
    message: string,
    meta: Record<string, unknown> = {}
  ): void {
    const operation = this.operations.get(operationId);
    const logger = operation?.log;

    // Only log if we have a logger
    if (logger && typeof logger[level] === 'function') {
      // Create a prefixed message
      const prefixedMessage = `[AsyncOp ${operationId}] ${message}`;

      // Always pass meta as an object to ensure consistent handling
      logger[level](prefixedMessage, meta);
    }
    // No fallback - if logger doesn't exist, we don't log
  }

  /**
   * Registers an event listener for the specified event.
   * @param {string} eventName - The name of the event to listen for
   * @param {function(unknown): void} listener - The callback function to execute when the event occurs
   */
  on(eventName: string, listener: (data: unknown) => void): void {
    if (!this.listeners.has(eventName)) {
      this.listeners.set(eventName, []);
    }
    this.listeners.get(eventName)?.push(listener);
  }

  /**
   * Emits an event with the specified data to all registered listeners.
   * @param {string} eventName - The name of the event to emit
   * @param {unknown} data - The data to pass to the event listeners
   */
  emit(eventName: string, data: unknown): void {
    if (this.listeners.has(eventName)) {
      this.listeners.get(eventName)?.forEach((listener) => listener(data));
    }
  }
}

/**
 * Singleton instance of the AsyncOperationManager.
 * Use this instance to manage asynchronous operations throughout the application.
 * @const {AsyncOperationManager}
 */
export const asyncOperationManager = new AsyncOperationManager();
