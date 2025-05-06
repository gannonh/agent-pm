/**
 * @fileoverview Type definitions for MCP async operations.
 * Provides interfaces and types for the MCP-specific async operation management.
 */

import { OperationStatus as CoreOperationStatus } from '../../core/utils/async-manager.js';

/**
 * Represents the current state of an MCP async operation.
 * Maps to the core OperationStatus but with MCP-specific naming.
 */
export enum AsyncOperationStatus {
  NOT_STARTED = 'pending',
  IN_PROGRESS = 'running',
  COMPLETED = 'completed',
  FAILED = 'failed',
  CANCELLED = 'cancelled',
  NOT_FOUND = 'not_found',
}

/**
 * Maps MCP AsyncOperationStatus to core OperationStatus.
 * @param status The MCP-specific status to convert
 * @returns The equivalent core OperationStatus
 */
export const mapToCoreStatus = (status: AsyncOperationStatus): CoreOperationStatus => {
  switch (status) {
    case AsyncOperationStatus.NOT_STARTED:
      return 'pending';
    case AsyncOperationStatus.IN_PROGRESS:
      return 'running';
    case AsyncOperationStatus.COMPLETED:
      return 'completed';
    case AsyncOperationStatus.FAILED:
      return 'failed';
    case AsyncOperationStatus.CANCELLED:
      return 'cancelled';
    case AsyncOperationStatus.NOT_FOUND:
      return 'not_found';
    default:
      return 'pending';
  }
};

/**
 * Maps core OperationStatus to MCP AsyncOperationStatus.
 * @param status The core status to convert
 * @returns The equivalent MCP-specific AsyncOperationStatus
 */
export const mapFromCoreStatus = (status: CoreOperationStatus): AsyncOperationStatus => {
  switch (status) {
    case 'pending':
      return AsyncOperationStatus.NOT_STARTED;
    case 'running':
      return AsyncOperationStatus.IN_PROGRESS;
    case 'completed':
      return AsyncOperationStatus.COMPLETED;
    case 'failed':
      return AsyncOperationStatus.FAILED;
    case 'cancelled':
      return AsyncOperationStatus.CANCELLED;
    case 'not_found':
      return AsyncOperationStatus.NOT_FOUND;
    default:
      return AsyncOperationStatus.NOT_STARTED;
  }
};

/**
 * Represents the result of an async operation, including any errors that occurred.
 * @template T The type of the operation's result data
 */
export interface AsyncOperationResult<T = unknown> {
  /**
   * The data returned by the operation, if successful
   */
  data: T | null;

  /**
   * Error information if the operation failed
   */
  error: {
    code: string;
    message: string;
  } | null;

  /**
   * Additional metadata about the operation result
   */
  metadata?: Record<string, unknown>;
}

/**
 * Represents an async operation with its status and result information.
 * @template T The type of the operation's result data
 */
export interface AsyncOperation<T = unknown> {
  /**
   * Unique identifier for the operation
   */
  id: string;

  /**
   * Current status of the operation
   */
  status: AsyncOperationStatus;

  /**
   * Type of operation being performed (e.g., 'prd-parse', 'task-expand')
   */
  operationType: string;

  /**
   * Timestamp when the operation was created (milliseconds since epoch)
   */
  createdAt: number;

  /**
   * Timestamp when the operation was last updated (milliseconds since epoch)
   */
  updatedAt: number;

  /**
   * Timestamp when the operation completed or failed (milliseconds since epoch)
   */
  completedAt: number | null;

  /**
   * Current progress of the operation (0-100)
   */
  progress: number;

  /**
   * Optional status message describing the current state
   */
  statusMessage?: string;

  /**
   * Optional estimated time remaining in seconds
   */
  estimatedTimeRemaining?: number;

  /**
   * Optional estimated completion time (timestamp)
   */
  estimatedEndTime?: number;

  /**
   * Optional current step in a multi-step operation
   */
  currentStep?: string;

  /**
   * Optional total number of steps in the operation
   */
  totalSteps?: number;

  /**
   * Optional current step number (1-based)
   */
  currentStepNumber?: number;

  /**
   * Optional array of steps in the operation
   */
  steps?: string[];

  /**
   * Result of the operation, available when status is COMPLETED or FAILED
   */
  result: AsyncOperationResult<T> | null;
}

/**
 * Progress information for an ongoing operation
 */
export interface AsyncOperationProgress {
  /**
   * Percentage of completion (0-100)
   */
  progress: number;

  /**
   * Optional total units to process (for calculating percentage)
   */
  total?: number;

  /**
   * Optional message describing the current progress state
   */
  message?: string;

  /**
   * Optional timestamp when this progress update was reported
   */
  timestamp?: number;

  /**
   * Optional estimated time remaining in seconds
   */
  estimatedTimeRemaining?: number;

  /**
   * Optional estimated completion time (timestamp)
   */
  estimatedEndTime?: number;

  /**
   * Optional current step in a multi-step operation
   */
  currentStep?: string;

  /**
   * Optional total number of steps in the operation
   */
  totalSteps?: number;

  /**
   * Optional current step number (1-based)
   */
  currentStepNumber?: number;

  /**
   * Optional array of steps in the operation
   */
  steps?: string[];
}

/**
 * Parameters for creating a new async operation
 */
export interface CreateOperationParams {
  /**
   * Type of operation being performed (e.g., 'prd-parse', 'task-expand')
   */
  operationType: string;

  /**
   * Parameters specific to the operation type
   */
  params: Record<string, unknown>;
}
